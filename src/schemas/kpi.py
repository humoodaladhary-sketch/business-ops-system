from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class KPICreate(BaseModel):
    name: str
    category: str
    weight: float
    unit: str = "%"
    target_value: float
    frequency: str = "monthly"
    priority: int = 5


class KPIResponse(BaseModel):
    id: int
    name: str
    category: str
    weight: float
    unit: str
    target_value: float
    current_value: float
    status: str
    priority: int

    class Config:
        from_attributes = True


class KPIEntryCreate(BaseModel):
    kpi_id: int
    value: float
    notes: Optional[str] = None
    week_number: Optional[int] = None
    month: Optional[int] = None


class SATRecordCreate(BaseModel):
    site_id: str
    site_name: str
    region: str
    sat_date: Optional[date] = None
    sla_deadline: date
    contractor: str
    ho_documents_complete: bool = False
    pre_check_done: bool = False


class AuditItemCreate(BaseModel):
    audit_name: str
    data_center: str
    category: str
    checklist_item: str
    due_date: Optional[date] = None


class WeeklyStatusResponse(BaseModel):
    week_number: int
    kpi_name: str
    weight: float
    target: str
    actual: str
    score: float
    status: str
    risk: Optional[str]
    action_required: Optional[str]

    class Config:
        from_attributes = True


class RiskResponse(BaseModel):
    id: int
    risk_description: str
    kpi_affected: str
    severity: str
    likelihood: str
    impact: str
    mitigation: str
    status: str

    class Config:
        from_attributes = True
