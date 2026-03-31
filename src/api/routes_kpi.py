from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.services import kpi_service
from src.schemas.kpi import KPIEntryCreate, SATRecordCreate, AuditItemCreate

router = APIRouter(prefix="/api", tags=["kpi"])


@router.get("/kpis")
async def list_kpis(db: Session = Depends(get_db)):
    return kpi_service.get_all_kpis(db)


@router.get("/kpis/category/{category}")
async def kpis_by_category(category: str, db: Session = Depends(get_db)):
    return kpi_service.get_kpi_by_category(db, category)


@router.post("/kpis/entry")
async def record_entry(entry: KPIEntryCreate, db: Session = Depends(get_db)):
    return kpi_service.record_kpi_entry(
        db, entry.kpi_id, entry.value, entry.notes, entry.week_number, entry.month
    )


@router.get("/dashboard")
async def dashboard(db: Session = Depends(get_db)):
    return kpi_service.get_dashboard_summary(db)


@router.get("/weekly-status/{week_number}")
async def weekly_status(week_number: int, db: Session = Depends(get_db)):
    return kpi_service.generate_weekly_status(db, week_number)


# --- SAT SLA ---

@router.get("/sat/records")
async def sat_records(status: str = None, db: Session = Depends(get_db)):
    return kpi_service.get_sat_records(db, status)


@router.get("/sat/compliance")
async def sat_compliance(db: Session = Depends(get_db)):
    return kpi_service.get_sat_sla_compliance(db)


@router.get("/sat/risks")
async def sat_risks(db: Session = Depends(get_db)):
    return kpi_service.flag_sat_risks(db)


# --- Audit ---

@router.get("/audit/items")
async def audit_items(status: str = None, db: Session = Depends(get_db)):
    return kpi_service.get_audit_items(db, status)


@router.get("/audit/summary")
async def audit_summary(db: Session = Depends(get_db)):
    return kpi_service.get_audit_summary(db)


# --- CQI ---

@router.get("/cqi/ideas")
async def cqi_ideas(db: Session = Depends(get_db)):
    return kpi_service.get_cqi_ideas(db)


# --- Risks ---

@router.get("/risks")
async def open_risks(db: Session = Depends(get_db)):
    return kpi_service.get_open_risks(db)
