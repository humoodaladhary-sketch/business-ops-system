"""
Generate weekly KPI status report for Hamood Al Adhari.
Run: python -m scripts.generate_weekly
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import date, timedelta
from src.database import SessionLocal
from src.services.kpi_service import (
    get_all_kpis, get_sat_sla_compliance, flag_sat_risks,
    get_audit_summary, get_open_risks, get_dashboard_summary
)
from src.config import REPORTS_DIR


def generate_weekly_report():
    db = SessionLocal()
    today = date.today()
    week_num = today.isocalendar()[1]

    dashboard = get_dashboard_summary(db)
    kpis = get_all_kpis(db)
    sat_compliance = get_sat_sla_compliance(db)
    sat_risks = flag_sat_risks(db)
    audit_summary = get_audit_summary(db)
    risks = get_open_risks(db)

    report = []
    report.append("=" * 70)
    report.append(f"WEEKLY KPI STATUS REPORT — WEEK {week_num}, {today.year}")
    report.append(f"Engineer: Hamood Al Adhari | Senior QM Engineer | Oman Broadband")
    report.append(f"Report Date: {today.strftime('%d %B %Y')}")
    report.append("=" * 70)

    # Overall Score
    report.append(f"\nOVERALL SCORE: {dashboard['overall_score']:.1f}% — {dashboard['rating']}")
    report.append(f"KPIs Behind: {dashboard['kpis_behind']} | KPIs At Risk: {dashboard['kpis_at_risk']}")

    # KPI Table
    report.append("\n" + "-" * 70)
    report.append("KPI PERFORMANCE SUMMARY")
    report.append("-" * 70)
    report.append(f"{'P':>2} {'KPI':<35} {'Wt':>4} {'Target':>8} {'Actual':>8} {'Score':>6} {'Status':<12}")
    report.append("-" * 70)

    for k in sorted(kpis, key=lambda x: x.priority):
        score = min((k.current_value / k.target_value) * k.weight, k.weight) if k.target_value else 0
        status_str = k.status.value if hasattr(k.status, 'value') else str(k.status)
        report.append(
            f"{k.priority:>2} {k.name:<35} {k.weight:>3.0f}% {k.target_value:>7.0f} {k.current_value:>7.0f} "
            f"{score:>5.1f} {status_str:<12}"
        )

    # SAT SLA Focus
    report.append("\n" + "-" * 70)
    report.append("SAT SLA STATUS (Priority 1 — 20%)")
    report.append("-" * 70)
    report.append(f"Compliance Rate: {sat_compliance.get('compliance_rate', 0)}%")
    report.append(f"Total Sites: {sat_compliance.get('total', 0)} | On Time: {sat_compliance.get('on_time', 0)} | Delayed: {sat_compliance.get('delayed', 0)}")
    report.append(f"Missing HO Documents: {sat_compliance.get('missing_ho_documents', 0)}")
    report.append(f"No Pre-Check Done: {sat_compliance.get('no_precheck', 0)}")
    report.append(f"RISK FLAG: {sat_compliance.get('risk_flag', 'N/A')}")

    if sat_risks:
        report.append("\nSAT RISKS:")
        for r in sat_risks:
            report.append(f"  [{r['risk_level']}] {r['site_id']} — {r.get('site_name', '')} — Deadline: {r['sla_deadline']} — Days left: {r['days_remaining']}")
            report.append(f"           Action: {r['action']}")

    # Audit
    report.append("\n" + "-" * 70)
    report.append("DATA CENTER AUDIT STATUS (Priority 2 — 15%)")
    report.append("-" * 70)
    report.append(f"Total Items: {audit_summary.get('total_items', 0)} | Compliant: {audit_summary.get('compliant', 0)} | Non-Compliant: {audit_summary.get('non_compliant', 0)}")
    report.append(f"Compliance Rate: {audit_summary.get('compliance_rate', 0)}%")

    # Risks
    report.append("\n" + "-" * 70)
    report.append("ACTIVE RISKS")
    report.append("-" * 70)
    for r in risks:
        sev = r.severity.value if hasattr(r.severity, 'value') else str(r.severity)
        report.append(f"  [{sev.upper()}] {r.risk_description}")
        report.append(f"           KPI: {r.kpi_affected} | Mitigation: {r.mitigation[:80]}...")

    # Actions
    report.append("\n" + "-" * 70)
    report.append("REQUIRED ACTIONS THIS WEEK")
    report.append("-" * 70)

    actions = _generate_actions(kpis, sat_risks, audit_summary)
    for i, action in enumerate(actions, 1):
        report.append(f"  {i}. {action}")

    report.append("\n" + "=" * 70)
    report.append("END OF REPORT")
    report.append("=" * 70)

    report_text = "\n".join(report)

    # Save to file
    report_file = REPORTS_DIR / f"weekly_report_W{week_num}_{today.year}.txt"
    report_file.write_text(report_text)
    print(report_text)
    print(f"\nReport saved to: {report_file}")

    db.close()
    return report_text


def _generate_actions(kpis, sat_risks, audit_summary):
    actions = []

    # SAT actions
    critical_sats = [r for r in sat_risks if r['risk_level'] == 'CRITICAL']
    if critical_sats:
        for s in critical_sats:
            actions.append(f"URGENT: Chase HO documents for {s['site_id']} ({s.get('site_name', '')}) — deadline {s['sla_deadline']}")

    ho_missing = [r for r in sat_risks if not r.get('ho_complete')]
    if ho_missing:
        actions.append(f"Send escalation email to contractors for {len(ho_missing)} sites with missing HO documents")

    precheck_missing = [r for r in sat_risks if not r.get('precheck_done')]
    if precheck_missing:
        actions.append(f"Schedule pre-checks for {len(precheck_missing)} sites immediately")

    # Audit actions
    if audit_summary.get('non_compliant', 0) > 0:
        actions.append(f"Close {audit_summary['non_compliant']} non-compliant audit findings with corrective actions")

    if audit_summary.get('pending', 0) > 0:
        actions.append(f"Begin {audit_summary['pending']} pending audit items — schedule site visits")

    # KPI-specific
    for k in kpis:
        status_val = k.status.value if hasattr(k.status, 'value') else str(k.status)
        if status_val == 'behind':
            actions.append(f"Recovery plan needed: {k.name} at {k.current_value}/{k.target_value}")

    if not actions:
        actions.append("All KPIs on track — maintain current trajectory")

    return actions


if __name__ == "__main__":
    generate_weekly_report()
