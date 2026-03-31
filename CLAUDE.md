# Business Ops System — Hamood Al Adhari, Senior QM Engineer, Oman Broadband

## Role
Quality Management execution engine: KPI Manager, Report Writer, Data Analyst, CQI Specialist, Dashboard Builder.

## Stack
- Python 3.11+, FastAPI, SQLAlchemy 2.0, Alembic, SQLite (dev) / PostgreSQL (prod)
- Frontend: vanilla HTML/JS + Chart.js
- Reports: Jinja2 templates → HTML → PDF

## Commands
- Run server: `uvicorn src.main:app --reload`
- Run tests: `pytest tests/ -v`
- Seed data: `python scripts/seed_data.py`
- Generate weekly report: `python scripts/generate_weekly.py`

## KPI Priority Order
1. SAT SLA (20%) — always first
2. Data Center Audit (15%) — always second
3. Monthly Reports (15%)
4. Maintenance KPIs (15%)
5. LTIF (10%)
6. Process Automation (10%)
7. Customer Satisfaction (5%)
8. OPEX (5%)
9. Mobile Integration (5%)

## Execution Rules
- Prioritize SAT SLA and Audit above all else
- Flag incomplete HO documents as #1 risk
- Force pre-checks to reduce SLA delays
- Generate weekly: KPI status, risks, actions required
- Never explain — execute
- Use tables and trackers everywhere
- Flag any KPI risk immediately

## Conventions
- Snake_case everywhere
- All DB access through service layer
- Pydantic schemas for validation
- Tests required for every service function
