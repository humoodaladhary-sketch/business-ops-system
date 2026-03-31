from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Text,
    ForeignKey, Boolean, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
import enum

from src.database import Base


class KPIStatus(enum.Enum):
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BEHIND = "behind"
    COMPLETED = "completed"


class Severity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    head = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    kpis = relationship("KPI", back_populates="department")


class KPI(Base):
    __tablename__ = "kpis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    department_id = Column(Integer, ForeignKey("departments.id"))
    name = Column(String(200), nullable=False)
    category = Column(String(100))  # SAT SLA, Audit, Reports, etc.
    weight = Column(Float, nullable=False)  # percentage weight
    unit = Column(String(50))  # %, count, days, score
    target_value = Column(Float)
    current_value = Column(Float, default=0)
    frequency = Column(String(20), default="monthly")  # daily/weekly/monthly/quarterly
    status = Column(SQLEnum(KPIStatus), default=KPIStatus.ON_TRACK)
    priority = Column(Integer, default=5)  # 1=highest
    year = Column(Integer, default=2026)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = relationship("Department", back_populates="kpis")
    entries = relationship("KPIEntry", back_populates="kpi")
    goals = relationship("Goal", back_populates="kpi")
    alerts = relationship("Alert", back_populates="kpi")


class KPIEntry(Base):
    __tablename__ = "kpi_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kpi_id = Column(Integer, ForeignKey("kpis.id"), nullable=False)
    value = Column(Float, nullable=False)
    notes = Column(Text)
    recorded_at = Column(Date, default=date.today)
    recorded_by = Column(String(100), default="Hamood Al Adhari")
    week_number = Column(Integer)
    month = Column(Integer)

    kpi = relationship("KPI", back_populates="entries")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kpi_id = Column(Integer, ForeignKey("kpis.id"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    target = Column(Float, nullable=False)
    actual = Column(Float, default=0)
    status = Column(SQLEnum(KPIStatus), default=KPIStatus.ON_TRACK)

    kpi = relationship("KPI", back_populates="goals")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kpi_id = Column(Integer, ForeignKey("kpis.id"), nullable=False)
    threshold_type = Column(String(20))  # above, below
    threshold_value = Column(Float)
    notify_emails = Column(Text)
    is_active = Column(Boolean, default=True)
    triggered_at = Column(DateTime)

    kpi = relationship("KPI", back_populates="alerts")


class WeeklyStatus(Base):
    __tablename__ = "weekly_statuses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_number = Column(Integer, nullable=False)
    year = Column(Integer, default=2026)
    kpi_name = Column(String(200), nullable=False)
    weight = Column(Float)
    target = Column(String(100))
    actual = Column(String(100))
    score = Column(Float)  # weighted score achieved
    status = Column(SQLEnum(KPIStatus), default=KPIStatus.ON_TRACK)
    risk = Column(Text)
    action_required = Column(Text)
    owner = Column(String(100), default="Hamood Al Adhari")
    generated_at = Column(DateTime, default=datetime.utcnow)


class SATRecord(Base):
    """Site Acceptance Test tracking"""
    __tablename__ = "sat_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    site_id = Column(String(50), nullable=False)
    site_name = Column(String(200))
    region = Column(String(100))
    sat_date = Column(Date)
    sla_deadline = Column(Date)
    completion_date = Column(Date)
    status = Column(String(50))  # pending, in_progress, completed, delayed
    snag_count = Column(Integer, default=0)
    snags_resolved = Column(Integer, default=0)
    ho_documents_complete = Column(Boolean, default=False)
    pre_check_done = Column(Boolean, default=False)
    delay_days = Column(Integer, default=0)
    delay_reason = Column(Text)
    contractor = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditItem(Base):
    """Data center audit tracking"""
    __tablename__ = "audit_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    audit_name = Column(String(200), nullable=False)
    data_center = Column(String(200))
    category = Column(String(100))  # physical, environmental, electrical, fire, access
    checklist_item = Column(Text)
    status = Column(String(50), default="pending")  # pending, in_progress, compliant, non_compliant, na
    finding = Column(Text)
    severity = Column(SQLEnum(Severity), default=Severity.LOW)
    corrective_action = Column(Text)
    due_date = Column(Date)
    completion_date = Column(Date)
    evidence = Column(Text)
    auditor = Column(String(100), default="Hamood Al Adhari")
    created_at = Column(DateTime, default=datetime.utcnow)


class CQIIdea(Base):
    """Continual Quality Improvement ideas"""
    __tablename__ = "cqi_ideas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(300), nullable=False)
    category = Column(String(100))  # process, automation, cost, safety, customer
    description = Column(Text)
    expected_impact = Column(Text)
    effort = Column(String(20))  # low, medium, high
    status = Column(String(50), default="proposed")  # proposed, approved, in_progress, completed
    kpi_affected = Column(String(200))
    estimated_improvement = Column(String(100))
    proposed_by = Column(String(100), default="Hamood Al Adhari")
    proposed_date = Column(Date, default=date.today)
    completion_date = Column(Date)


class RiskRegister(Base):
    """Risk tracking for KPI delivery"""
    __tablename__ = "risk_register"

    id = Column(Integer, primary_key=True, autoincrement=True)
    risk_description = Column(Text, nullable=False)
    kpi_affected = Column(String(200))
    severity = Column(SQLEnum(Severity), default=Severity.MEDIUM)
    likelihood = Column(String(20))  # low, medium, high
    impact = Column(Text)
    mitigation = Column(Text)
    owner = Column(String(100), default="Hamood Al Adhari")
    status = Column(String(50), default="open")  # open, mitigating, closed
    identified_date = Column(Date, default=date.today)
    review_date = Column(Date)
