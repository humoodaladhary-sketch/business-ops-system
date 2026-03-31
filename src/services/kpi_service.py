from datetime import date, datetime
from sqlalchemy.orm import Session
from src.models.kpi import (
    KPI, KPIEntry, WeeklyStatus, SATRecord, AuditItem,
    CQIIdea, RiskRegister, KPIStatus, Severity, Department
)


def get_all_kpis(db: Session) -> list[KPI]:
    return db.query(KPI).order_by(KPI.priority).all()


def get_kpi_by_category(db: Session, category: str) -> list[KPI]:
    return db.query(KPI).filter(KPI.category == category).all()


def record_kpi_entry(db: Session, kpi_id: int, value: float, notes: str = None,
                     week_number: int = None, month: int = None) -> KPIEntry:
    entry = KPIEntry(
        kpi_id=kpi_id,
        value=value,
        notes=notes,
        week_number=week_number,
        month=month,
    )
    db.add(entry)

    # Update current value on KPI
    kpi = db.query(KPI).filter(KPI.id == kpi_id).first()
    if kpi:
        kpi.current_value = value
        kpi.updated_at = datetime.utcnow()
        _update_kpi_status(kpi)

    db.commit()
    db.refresh(entry)
    return entry


def _update_kpi_status(kpi: KPI):
    if kpi.target_value and kpi.target_value > 0:
        ratio = kpi.current_value / kpi.target_value
        if ratio >= 0.95:
            kpi.status = KPIStatus.ON_TRACK
        elif ratio >= 0.80:
            kpi.status = KPIStatus.AT_RISK
        else:
            kpi.status = KPIStatus.BEHIND


def generate_weekly_status(db: Session, week_number: int, year: int = 2026) -> list[WeeklyStatus]:
    """Generate weekly status for all KPIs."""
    kpis = get_all_kpis(db)
    statuses = []

    for kpi in kpis:
        # Calculate score: (current/target) * weight
        score = 0.0
        if kpi.target_value and kpi.target_value > 0:
            score = min((kpi.current_value / kpi.target_value) * kpi.weight, kpi.weight)

        risk = _assess_risk(kpi)
        action = _recommend_action(kpi)

        ws = WeeklyStatus(
            week_number=week_number,
            year=year,
            kpi_name=kpi.name,
            weight=kpi.weight,
            target=f"{kpi.target_value} {kpi.unit}",
            actual=f"{kpi.current_value} {kpi.unit}",
            score=round(score, 2),
            status=kpi.status,
            risk=risk,
            action_required=action,
        )
        db.add(ws)
        statuses.append(ws)

    db.commit()
    return statuses


def _assess_risk(kpi: KPI) -> str:
    if kpi.status == KPIStatus.BEHIND:
        return f"CRITICAL: {kpi.name} at {kpi.current_value}/{kpi.target_value} — immediate action required"
    elif kpi.status == KPIStatus.AT_RISK:
        return f"WARNING: {kpi.name} trending below target — monitor closely"
    return "No immediate risk"


def _recommend_action(kpi: KPI) -> str:
    if kpi.category == "SAT SLA" and kpi.status != KPIStatus.ON_TRACK:
        return "Escalate HO document delays. Run pre-check on all pending SATs. Follow up with contractors daily."
    elif kpi.category == "Data Center Audit" and kpi.status != KPIStatus.ON_TRACK:
        return "Schedule audit catch-up sessions. Complete checklist gaps immediately."
    elif kpi.category == "Monthly Reports" and kpi.status != KPIStatus.ON_TRACK:
        return "Draft reports before 20th of month. Collect data from all departments by 15th."
    elif kpi.status == KPIStatus.BEHIND:
        return f"Immediate recovery plan needed for {kpi.name}"
    elif kpi.status == KPIStatus.AT_RISK:
        return f"Increase monitoring frequency for {kpi.name}"
    return "Maintain current trajectory"


# --- SAT SLA Operations ---

def get_sat_records(db: Session, status: str = None) -> list[SATRecord]:
    query = db.query(SATRecord)
    if status:
        query = query.filter(SATRecord.status == status)
    return query.order_by(SATRecord.sla_deadline).all()


def get_sat_sla_compliance(db: Session) -> dict:
    total = db.query(SATRecord).count()
    if total == 0:
        return {"compliance_rate": 0, "total": 0, "on_time": 0, "delayed": 0}

    on_time = db.query(SATRecord).filter(
        SATRecord.status == "completed",
        SATRecord.delay_days == 0
    ).count()
    delayed = db.query(SATRecord).filter(SATRecord.delay_days > 0).count()
    missing_ho = db.query(SATRecord).filter(SATRecord.ho_documents_complete == False).count()
    no_precheck = db.query(SATRecord).filter(SATRecord.pre_check_done == False).count()

    return {
        "compliance_rate": round((on_time / total) * 100, 1) if total else 0,
        "total": total,
        "on_time": on_time,
        "delayed": delayed,
        "missing_ho_documents": missing_ho,
        "no_precheck": no_precheck,
        "risk_flag": "HIGH — HO docs incomplete" if missing_ho > 0 else "LOW",
    }


def flag_sat_risks(db: Session) -> list[dict]:
    """Flag all SAT records at risk of SLA breach."""
    today = date.today()
    risks = []

    pending_sats = db.query(SATRecord).filter(
        SATRecord.status.in_(["pending", "in_progress"])
    ).all()

    for sat in pending_sats:
        days_remaining = (sat.sla_deadline - today).days if sat.sla_deadline else 0
        risk_level = "LOW"

        if not sat.ho_documents_complete:
            risk_level = "CRITICAL"
        elif not sat.pre_check_done and days_remaining < 7:
            risk_level = "HIGH"
        elif days_remaining < 3:
            risk_level = "HIGH"
        elif days_remaining < 7:
            risk_level = "MEDIUM"

        if risk_level in ("CRITICAL", "HIGH", "MEDIUM"):
            risks.append({
                "site_id": sat.site_id,
                "site_name": sat.site_name,
                "sla_deadline": str(sat.sla_deadline),
                "days_remaining": days_remaining,
                "risk_level": risk_level,
                "ho_complete": sat.ho_documents_complete,
                "precheck_done": sat.pre_check_done,
                "action": _sat_action(sat, days_remaining),
            })

    return sorted(risks, key=lambda x: {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}.get(x["risk_level"], 3))


def _sat_action(sat: SATRecord, days_remaining: int) -> str:
    actions = []
    if not sat.ho_documents_complete:
        actions.append("URGENT: Chase HO documents from contractor")
    if not sat.pre_check_done:
        actions.append("Schedule and complete pre-check immediately")
    if days_remaining < 3:
        actions.append("Escalate to management — SLA breach imminent")
    if sat.snag_count > sat.snags_resolved:
        actions.append(f"Resolve {sat.snag_count - sat.snags_resolved} outstanding snags")
    return " | ".join(actions) if actions else "Monitor"


# --- Audit Operations ---

def get_audit_items(db: Session, status: str = None) -> list[AuditItem]:
    query = db.query(AuditItem)
    if status:
        query = query.filter(AuditItem.status == status)
    return query.order_by(AuditItem.due_date).all()


def get_audit_summary(db: Session) -> dict:
    total = db.query(AuditItem).count()
    compliant = db.query(AuditItem).filter(AuditItem.status == "compliant").count()
    non_compliant = db.query(AuditItem).filter(AuditItem.status == "non_compliant").count()
    pending = db.query(AuditItem).filter(AuditItem.status == "pending").count()
    in_progress = db.query(AuditItem).filter(AuditItem.status == "in_progress").count()

    return {
        "total_items": total,
        "compliant": compliant,
        "non_compliant": non_compliant,
        "pending": pending,
        "in_progress": in_progress,
        "compliance_rate": round((compliant / total) * 100, 1) if total else 0,
    }


# --- CQI Operations ---

def get_cqi_ideas(db: Session) -> list[CQIIdea]:
    return db.query(CQIIdea).order_by(CQIIdea.proposed_date.desc()).all()


# --- Risk Operations ---

def get_open_risks(db: Session) -> list[RiskRegister]:
    return db.query(RiskRegister).filter(
        RiskRegister.status != "closed"
    ).order_by(
        RiskRegister.severity.desc()
    ).all()


def get_dashboard_summary(db: Session) -> dict:
    """Full dashboard summary for Hamood."""
    kpis = get_all_kpis(db)
    sat_compliance = get_sat_sla_compliance(db)
    audit_summary = get_audit_summary(db)
    sat_risks = flag_sat_risks(db)
    open_risks = get_open_risks(db)

    total_score = sum(
        min((k.current_value / k.target_value) * k.weight, k.weight)
        for k in kpis if k.target_value and k.target_value > 0
    )

    behind_count = sum(1 for k in kpis if k.status == KPIStatus.BEHIND)
    at_risk_count = sum(1 for k in kpis if k.status == KPIStatus.AT_RISK)

    return {
        "engineer": "Hamood Al Adhari",
        "title": "Senior Quality Management Engineer",
        "company": "Oman Broadband",
        "report_date": str(date.today()),
        "overall_score": round(total_score, 2),
        "max_score": 100.0,
        "rating": _get_rating(total_score),
        "kpis_behind": behind_count,
        "kpis_at_risk": at_risk_count,
        "sat_compliance": sat_compliance,
        "audit_summary": audit_summary,
        "critical_sat_risks": len([r for r in sat_risks if r["risk_level"] == "CRITICAL"]),
        "open_risks_count": len(open_risks),
    }


def _get_rating(score: float) -> str:
    if score >= 95:
        return "OUTSTANDING"
    elif score >= 85:
        return "EXCEEDS EXPECTATIONS"
    elif score >= 70:
        return "MEETS EXPECTATIONS"
    elif score >= 50:
        return "NEEDS IMPROVEMENT"
    return "UNSATISFACTORY"
