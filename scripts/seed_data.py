"""
Seed database with Hamood Al Adhari's KPI data for Oman Broadband.
Run: python -m scripts.seed_data
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, timedelta
from src.database import init_db, SessionLocal
from src.models.kpi import (
    Department, KPI, KPIEntry, SATRecord, AuditItem,
    CQIIdea, RiskRegister, KPIStatus, Severity
)


def seed():
    init_db()
    db = SessionLocal()

    # Clear existing data
    for model in [RiskRegister, CQIIdea, AuditItem, SATRecord, KPIEntry, KPI, Department]:
        db.query(model).delete()
    db.commit()

    # --- Department ---
    qm_dept = Department(name="Quality Management", head="Hamood Al Adhari")
    db.add(qm_dept)
    db.flush()

    # --- 9 KPIs matching Hamood's targets ---
    kpis_data = [
        {"name": "SAT SLA Compliance", "category": "SAT SLA", "weight": 20.0,
         "unit": "%", "target_value": 95.0, "current_value": 82.0,
         "frequency": "weekly", "priority": 1, "status": KPIStatus.AT_RISK},

        {"name": "Monthly QM Reports", "category": "Monthly Reports", "weight": 15.0,
         "unit": "reports", "target_value": 12.0, "current_value": 3.0,
         "frequency": "monthly", "priority": 3, "status": KPIStatus.ON_TRACK},

        {"name": "Data Center Audit Completion", "category": "Data Center Audit", "weight": 15.0,
         "unit": "%", "target_value": 100.0, "current_value": 35.0,
         "frequency": "quarterly", "priority": 2, "status": KPIStatus.AT_RISK},

        {"name": "Maintenance KPI Achievement", "category": "Maintenance KPIs", "weight": 15.0,
         "unit": "%", "target_value": 90.0, "current_value": 78.0,
         "frequency": "monthly", "priority": 4, "status": KPIStatus.AT_RISK},

        {"name": "LTIF (Lost Time Injury Frequency)", "category": "LTIF", "weight": 10.0,
         "unit": "rate", "target_value": 0.0, "current_value": 0.0,
         "frequency": "monthly", "priority": 5, "status": KPIStatus.ON_TRACK},

        {"name": "Process Automation Initiatives", "category": "Process Automation", "weight": 10.0,
         "unit": "projects", "target_value": 4.0, "current_value": 1.0,
         "frequency": "quarterly", "priority": 6, "status": KPIStatus.AT_RISK},

        {"name": "Customer Satisfaction Score", "category": "Customer Satisfaction", "weight": 5.0,
         "unit": "%", "target_value": 85.0, "current_value": 79.0,
         "frequency": "quarterly", "priority": 7, "status": KPIStatus.AT_RISK},

        {"name": "OPEX Budget Compliance", "category": "OPEX", "weight": 5.0,
         "unit": "%", "target_value": 100.0, "current_value": 94.0,
         "frequency": "monthly", "priority": 8, "status": KPIStatus.ON_TRACK},

        {"name": "Mobile Network Integration QA", "category": "Mobile Integration", "weight": 5.0,
         "unit": "%", "target_value": 100.0, "current_value": 40.0,
         "frequency": "quarterly", "priority": 9, "status": KPIStatus.BEHIND},
    ]

    kpi_objects = []
    for kd in kpis_data:
        kpi = KPI(department_id=qm_dept.id, **kd)
        db.add(kpi)
        kpi_objects.append(kpi)
    db.flush()

    # --- SAT Records (realistic Oman sites) ---
    sat_records = [
        {"site_id": "MUS-001", "site_name": "Muscat Exchange Hub", "region": "Muscat",
         "sat_date": date(2026, 3, 15), "sla_deadline": date(2026, 4, 5),
         "status": "in_progress", "snag_count": 8, "snags_resolved": 3,
         "ho_documents_complete": False, "pre_check_done": True,
         "contractor": "Oman Fiber Co", "delay_reason": "HO docs pending from contractor"},

        {"site_id": "MUS-002", "site_name": "Al Khuwair Node", "region": "Muscat",
         "sat_date": date(2026, 3, 20), "sla_deadline": date(2026, 4, 10),
         "status": "in_progress", "snag_count": 5, "snags_resolved": 5,
         "ho_documents_complete": True, "pre_check_done": True,
         "contractor": "Gulf Telecom Services"},

        {"site_id": "SOH-001", "site_name": "Sohar Industrial DC", "region": "Al Batinah",
         "sat_date": date(2026, 3, 25), "sla_deadline": date(2026, 4, 8),
         "status": "pending", "snag_count": 0, "snags_resolved": 0,
         "ho_documents_complete": False, "pre_check_done": False,
         "contractor": "National Infra LLC", "delay_reason": "Awaiting HO package"},

        {"site_id": "SAL-001", "site_name": "Salalah Broadband Center", "region": "Dhofar",
         "sat_date": date(2026, 4, 1), "sla_deadline": date(2026, 4, 15),
         "status": "pending", "snag_count": 0, "snags_resolved": 0,
         "ho_documents_complete": False, "pre_check_done": False,
         "contractor": "Southern Connect"},

        {"site_id": "NIZ-001", "site_name": "Nizwa Distribution Hub", "region": "Ad Dakhiliyah",
         "sat_date": date(2026, 3, 10), "sla_deadline": date(2026, 3, 30),
         "status": "completed", "snag_count": 12, "snags_resolved": 12,
         "ho_documents_complete": True, "pre_check_done": True,
         "completion_date": date(2026, 3, 28), "delay_days": 0,
         "contractor": "Oman Fiber Co"},

        {"site_id": "SUR-001", "site_name": "Sur Coastal Node", "region": "Ash Sharqiyah",
         "sat_date": date(2026, 3, 18), "sla_deadline": date(2026, 4, 2),
         "status": "in_progress", "snag_count": 6, "snags_resolved": 2,
         "ho_documents_complete": False, "pre_check_done": False,
         "contractor": "Eastern Networks", "delay_reason": "Pre-check not scheduled, HO docs missing"},

        {"site_id": "BRK-001", "site_name": "Barka Access Point", "region": "Al Batinah",
         "sat_date": date(2026, 4, 5), "sla_deadline": date(2026, 4, 20),
         "status": "pending", "snag_count": 0, "snags_resolved": 0,
         "ho_documents_complete": True, "pre_check_done": False,
         "contractor": "Gulf Telecom Services"},

        {"site_id": "IBA-001", "site_name": "Ibra Junction Hub", "region": "Ash Sharqiyah",
         "sat_date": date(2026, 3, 22), "sla_deadline": date(2026, 4, 3),
         "status": "in_progress", "snag_count": 4, "snags_resolved": 1,
         "ho_documents_complete": False, "pre_check_done": True,
         "contractor": "National Infra LLC", "delay_reason": "Contractor delayed HO submission"},
    ]

    for sr in sat_records:
        db.add(SATRecord(**sr))

    # --- Audit Items ---
    audit_items = [
        {"audit_name": "Q1 2026 DC Audit", "data_center": "Muscat Primary DC",
         "category": "physical", "checklist_item": "Raised floor condition and cleanliness",
         "status": "compliant", "due_date": date(2026, 3, 31)},

        {"audit_name": "Q1 2026 DC Audit", "data_center": "Muscat Primary DC",
         "category": "environmental", "checklist_item": "HVAC redundancy and temperature monitoring",
         "status": "compliant", "due_date": date(2026, 3, 31)},

        {"audit_name": "Q1 2026 DC Audit", "data_center": "Muscat Primary DC",
         "category": "electrical", "checklist_item": "UPS capacity and battery health",
         "status": "non_compliant", "finding": "Battery bank 2 below threshold",
         "severity": Severity.HIGH, "corrective_action": "Replace battery bank 2",
         "due_date": date(2026, 4, 15)},

        {"audit_name": "Q1 2026 DC Audit", "data_center": "Muscat Primary DC",
         "category": "fire", "checklist_item": "Fire suppression system test",
         "status": "compliant", "due_date": date(2026, 3, 31)},

        {"audit_name": "Q1 2026 DC Audit", "data_center": "Muscat Primary DC",
         "category": "access", "checklist_item": "Access control log review",
         "status": "in_progress", "due_date": date(2026, 4, 5)},

        {"audit_name": "Q2 2026 DC Audit", "data_center": "Sohar Secondary DC",
         "category": "physical", "checklist_item": "Cable management and labeling",
         "status": "pending", "due_date": date(2026, 4, 30)},

        {"audit_name": "Q2 2026 DC Audit", "data_center": "Sohar Secondary DC",
         "category": "environmental", "checklist_item": "Humidity and leak detection",
         "status": "pending", "due_date": date(2026, 4, 30)},

        {"audit_name": "Q2 2026 DC Audit", "data_center": "Sohar Secondary DC",
         "category": "electrical", "checklist_item": "Generator fuel level and test run",
         "status": "pending", "due_date": date(2026, 4, 30)},

        {"audit_name": "Q2 2026 DC Audit", "data_center": "Salalah DR Site",
         "category": "physical", "checklist_item": "Rack utilization and capacity planning",
         "status": "pending", "due_date": date(2026, 5, 31)},

        {"audit_name": "Q2 2026 DC Audit", "data_center": "Salalah DR Site",
         "category": "access", "checklist_item": "Visitor log and escort policy compliance",
         "status": "pending", "due_date": date(2026, 5, 31)},
    ]

    for ai in audit_items:
        db.add(AuditItem(**ai))

    # --- CQI Ideas ---
    cqi_ideas = [
        {"title": "Automated SAT Pre-Check System",
         "category": "automation",
         "description": "Build automated pre-check workflow that validates HO documents, site photos, and test results before SAT scheduling. Reject incomplete submissions automatically.",
         "expected_impact": "Reduce SAT SLA delays by 40%. Eliminate incomplete HO document issue.",
         "effort": "medium", "kpi_affected": "SAT SLA", "estimated_improvement": "+15% SLA compliance"},

        {"title": "Real-Time KPI Dashboard with Auto-Alerts",
         "category": "automation",
         "description": "Deploy live dashboard that pulls data from all systems and sends automatic email/SMS alerts when any KPI drops below threshold.",
         "expected_impact": "Zero surprise KPI misses. Early intervention on all metrics.",
         "effort": "medium", "kpi_affected": "All KPIs", "estimated_improvement": "+10% overall score"},

        {"title": "Predictive Maintenance Scheduling",
         "category": "process",
         "description": "Use historical failure data to predict equipment maintenance needs and schedule proactively instead of reactively.",
         "expected_impact": "Reduce unplanned downtime by 30%. Improve maintenance KPI achievement.",
         "effort": "high", "kpi_affected": "Maintenance KPIs", "estimated_improvement": "+12% maintenance score"},

        {"title": "Digital Audit Checklist with Photo Evidence",
         "category": "process",
         "description": "Replace paper-based audit checklists with tablet-based digital forms that capture GPS-tagged photos as evidence. Auto-generate audit reports.",
         "expected_impact": "Cut audit completion time by 50%. Improve evidence quality.",
         "effort": "medium", "kpi_affected": "Data Center Audit", "estimated_improvement": "+20% audit efficiency"},

        {"title": "Contractor Performance Scorecard",
         "category": "process",
         "description": "Create automated scorecard tracking contractor SAT performance, HO document timeliness, and snag resolution rates. Share monthly with procurement.",
         "expected_impact": "Hold contractors accountable. Reduce HO document delays.",
         "effort": "low", "kpi_affected": "SAT SLA", "estimated_improvement": "+10% HO document compliance"},

        {"title": "Automated Monthly Report Generation",
         "category": "automation",
         "description": "Auto-generate monthly QM reports by pulling data from KPI system, formatting with templates, and routing for approval. One-click submission.",
         "expected_impact": "Save 2 days/month on report preparation. Never miss submission deadline.",
         "effort": "medium", "kpi_affected": "Monthly Reports", "estimated_improvement": "100% on-time submission"},

        {"title": "Customer Feedback Loop Automation",
         "category": "customer",
         "description": "Automated post-installation survey sent to customers after SAT completion. Results feed directly into satisfaction KPI.",
         "expected_impact": "Continuous customer feedback. Data-driven service improvement.",
         "effort": "low", "kpi_affected": "Customer Satisfaction", "estimated_improvement": "+5% satisfaction"},

        {"title": "Safety Near-Miss Reporting App",
         "category": "safety",
         "description": "Mobile app for field teams to report near-misses instantly. Builds safety database for LTIF prevention.",
         "expected_impact": "Proactive safety culture. Maintain zero LTIF.",
         "effort": "medium", "kpi_affected": "LTIF", "estimated_improvement": "Maintain 0.0 LTIF"},
    ]

    for ci in cqi_ideas:
        db.add(CQIIdea(**ci))

    # --- Risk Register ---
    risks = [
        {"risk_description": "Incomplete HO documents from contractors causing SAT SLA breaches",
         "kpi_affected": "SAT SLA (20%)", "severity": Severity.CRITICAL, "likelihood": "high",
         "impact": "Direct SLA breach. 20% of total KPI score at risk. Pattern of 4/8 sites with missing HO docs.",
         "mitigation": "1) Implement mandatory pre-check gate 2) Weekly contractor follow-up emails 3) Escalate to procurement after 48hr delay",
         "status": "open", "review_date": date(2026, 4, 3)},

        {"risk_description": "Data center audit Q2 scope too large for single engineer",
         "kpi_affected": "Data Center Audit (15%)", "severity": Severity.HIGH, "likelihood": "medium",
         "impact": "Audit completion delayed. 15% KPI weight missed if Sohar + Salalah audits slip.",
         "mitigation": "1) Request audit support resource 2) Pre-schedule all Q2 audit dates now 3) Complete Muscat Q1 items by Apr 5",
         "status": "open", "review_date": date(2026, 4, 7)},

        {"risk_description": "Mobile integration QA at 40% — lowest performing KPI",
         "kpi_affected": "Mobile Integration (5%)", "severity": Severity.MEDIUM, "likelihood": "high",
         "impact": "5% KPI weight partially lost. Signals lack of progress on strategic initiative.",
         "mitigation": "1) Align with mobile team on test plan 2) Block 2 days/week for mobile QA 3) Escalate resource gap",
         "status": "open", "review_date": date(2026, 4, 7)},

        {"risk_description": "Process automation only 1/4 projects completed in Q1",
         "kpi_affected": "Process Automation (10%)", "severity": Severity.MEDIUM, "likelihood": "medium",
         "impact": "10% KPI weight at risk if 3 more projects not delivered by year-end.",
         "mitigation": "1) Identify 2 quick-win automation projects for Q2 2) Leverage this KPI system as project #2 3) Plan project #3 for Q3",
         "status": "open", "review_date": date(2026, 4, 14)},

        {"risk_description": "Maintenance KPIs underperforming at 78% vs 90% target",
         "kpi_affected": "Maintenance KPIs (15%)", "severity": Severity.HIGH, "likelihood": "medium",
         "impact": "15% KPI weight significantly reduced. Gap of 12 percentage points to close.",
         "mitigation": "1) Root-cause analysis on failed maintenance items 2) Weekly maintenance review with ops team 3) Implement preventive maintenance schedule",
         "status": "open", "review_date": date(2026, 4, 7)},
    ]

    for r in risks:
        db.add(RiskRegister(**r))

    db.commit()
    db.close()
    print("Database seeded successfully with Hamood Al Adhari's KPI data.")
    print(f"  - 1 Department")
    print(f"  - {len(kpis_data)} KPIs")
    print(f"  - {len(sat_records)} SAT Records")
    print(f"  - {len(audit_items)} Audit Items")
    print(f"  - {len(cqi_ideas)} CQI Ideas")
    print(f"  - {len(risks)} Risk Register Entries")


if __name__ == "__main__":
    seed()
