"""
FastAPI application entrypoint

Developer: Aditi Devlekar
"""
from __future__ import annotations

import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from .auth import create_access_token, hash_password, require_role, verify_password, get_current_user
from .database import Base, engine, get_db
from .models import Appointment, Doctor, Patient, User
from .schemas import (
    AppointmentCreateResponse,
    DoctorAppointmentDetailResponse,
    DoctorCompleteAppointmentRequest,
    DoctorDashboardResponse,
    DoctorListItem,
    DoctorManualReassignRequest,
    DoctorUpdateAppointmentRequest,
    LoginRequest,
    PatientDashboardResponse,
    PatientRegisterRequest,
    PatientSymptomSubmitRequest,
    TokenResponse,
)
from .triage import triage

APP_NAME = "BARC Hospital, Mankhurd — Smart Triage & OPD Workflow (Demo)"

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def seed_doctors(db: Session) -> None:
    if db.query(Doctor).count() > 0:
        return

    seed = [
        ("dr_ashwini", "Doctor@1234", "Dr. Ashwini Kulkarni", "General Medicine"),
        ("dr_rahul", "Doctor@1234", "Dr. Rahul Deshmukh", "Cardiology"),
        ("dr_meera", "Doctor@1234", "Dr. Meera Iyer", "Dermatology"),
        ("dr_sanjay", "Doctor@1234", "Dr. Sanjay Patil", "ENT"),
        ("dr_neha", "Doctor@1234", "Dr. Neha Sharma", "Paediatrics"),
        ("dr_priya", "Doctor@1234", "Dr. Priya Nair", "Obstetrics & Gynaecology"),
        ("dr_omkar", "Doctor@1234", "Dr. Omkar Joshi", "Orthopaedics"),
        ("dr_farhan", "Doctor@1234", "Dr. Farhan Shaikh", "Pulmonology"),
        ("dr_kavita", "Doctor@1234", "Dr. Kavita Rao", "Ophthalmology"),
        ("dr_vivek", "Doctor@1234", "Dr. Vivek Gupta", "Dental"),
        ("dr_anita", "Doctor@1234", "Dr. Anita Sengupta", "Endocrinology"),
        ("dr_rohit", "Doctor@1234", "Dr. Rohit Bhosale", "Nephrology"),
        ("dr_emergency", "Doctor@1234", "Dr. Sameer Khan", "Emergency"),
    ]

    for username, password, full_name, dept in seed:
        user = User(username=username, password_hash=hash_password(password), role="doctor")
        db.add(user)
        db.flush()
        db.add(Doctor(user_id=user.id, full_name=full_name, department=dept, max_concurrent=4))

    db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # create tables
    Base.metadata.create_all(bind=engine)

    # seed doctors
    db = next(get_db())
    try:
        seed_doctors(db)
    finally:
        db.close()

    yield


app = FastAPI(title=APP_NAME, lifespan=lifespan)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.exception_handler(Exception)
async def all_exception_handler(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {str(exc)}"})


# -------------------
# Pages
# -------------------
@app.get("/", response_class=HTMLResponse)
def homepage(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "app_name": APP_NAME})


@app.get("/patient", response_class=HTMLResponse)
def patient_portal(request: Request):
    return templates.TemplateResponse("patient.html", {"request": request, "app_name": APP_NAME})


@app.get("/doctor", response_class=HTMLResponse)
def doctor_portal(request: Request):
    return templates.TemplateResponse("doctor.html", {"request": request, "app_name": APP_NAME})


# -------------------
# API
# -------------------
@app.get("/health")
def health():
    return {"status": "ok", "service": APP_NAME}


@app.post("/register/patient", status_code=201)
def register_patient(req: PatientRegisterRequest, db: Session = Depends(get_db)):
    user = User(username=req.username, password_hash=hash_password(req.password), role="patient")
    db.add(user)
    try:
        db.flush()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already exists")

    db.add(Patient(user_id=user.id, full_name=req.full_name))
    db.commit()
    return {"message": "registered", "username": user.username}


@app.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if user.role != req.role:
        raise HTTPException(status_code=403, detail="Please select the correct role (Patient/Doctor).")
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(sub=user.username, role=user.role)
    return TokenResponse(access_token=token)


@app.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"username": user.username, "role": user.role}


# -------------------
# Patient API
# -------------------
@app.post("/patient/submit", response_model=AppointmentCreateResponse)
def patient_submit(
    req: PatientSymptomSubmitRequest,
    user: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=400, detail="Patient profile not found")

    patient.full_name = req.name.strip()

    t = triage(req.symptoms)
    department = str(t["department"])
    severity = int(t["severity_score"])
    priority = str(t["priority"])

    doc = db.query(Doctor).filter(Doctor.department == department).order_by(Doctor.id.asc()).first()
    if not doc:
        doc = db.query(Doctor).filter(Doctor.department == "General Medicine").order_by(Doctor.id.asc()).first()
    if not doc:
        doc = db.query(Doctor).order_by(Doctor.id.asc()).first()
    if not doc:
        raise HTTPException(status_code=500, detail="No doctors configured in system")

    active_count = (
        db.query(Appointment)
        .filter(Appointment.department == department, Appointment.status == "Waiting")
        .count()
    )
    queue_position = int(active_count) + 1
    predicted_wait = max(10, queue_position * 12)

    appt = Appointment(
        appointment_token=secrets.token_hex(16),
        patient_id=patient.id,
        doctor_id=doc.id,
        department=department,
        symptoms=req.symptoms,
        severity_score=severity,
        priority=priority,
        predicted_wait_minutes=predicted_wait,
        queue_position=queue_position,
        status="Waiting",
        created_at=now_utc(),
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    return AppointmentCreateResponse(
        appointment_id=appt.id,
        assigned_doctor=doc.full_name,
        department=appt.department,
        severity=appt.severity_score,
        priority=appt.priority,  # type: ignore[arg-type]
        estimated_waiting_time_minutes=appt.predicted_wait_minutes,
        queue_position=appt.queue_position,
        status=appt.status,  # type: ignore[arg-type]
    )


@app.get("/patient/dashboard", response_model=PatientDashboardResponse)
def patient_dashboard(
    user: User = Depends(require_role("patient")),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()
    if not patient:
        raise HTTPException(status_code=400, detail="Patient profile not found")

    appts = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient.id)
        .order_by(Appointment.created_at.desc())
        .limit(20)
        .all()
    )

    items = []
    for a in appts:
        doc = db.query(Doctor).filter(Doctor.id == a.doctor_id).first()
        items.append(
            {
                "appointment_id": a.id,
                "created_at": a.created_at,
                "status": a.status,
                "department": a.department,
                "priority": a.priority,
                "severity": a.severity_score,
                "queue_position": a.queue_position,
                "estimated_waiting_time_minutes": a.predicted_wait_minutes,
                "assigned_doctor": doc.full_name if doc else None,
            }
        )

    tip = (
        "This tool provides general guidance and is not a substitute for medical advice. "
        "If you have severe symptoms (chest pain, breathing difficulty, heavy bleeding), seek emergency care immediately."
    )
    return {"patient": patient.full_name, "tip": tip, "appointments": items}


# -------------------
# Doctor API
# -------------------
@app.get("/doctor/dashboard", response_model=DoctorDashboardResponse)
def doctor_dashboard(
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile not found")

    appts = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id, Appointment.status == "Waiting")
        .order_by(Appointment.created_at.asc())
        .all()
    )

    items = []
    for a in appts:
        p = db.query(Patient).filter(Patient.id == a.patient_id).first()
        items.append(
            {
                "appointment_id": a.id,
                "created_at": a.created_at,
                "patient_name": p.full_name if p else "Unknown",
                "department": a.department,
                "priority": a.priority,
                "severity": a.severity_score,
                "queue_position": a.queue_position,
                "predicted_wait_minutes": a.predicted_wait_minutes,
                "status": a.status,
            }
        )

    return {"doctor": doctor.full_name, "department": doctor.department, "assigned_patients": items}


@app.get("/doctor/doctors", response_model=list[DoctorListItem])
def doctor_list_doctors(
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    docs = db.query(Doctor).order_by(Doctor.department.asc(), Doctor.full_name.asc()).all()
    return [{"id": d.id, "full_name": d.full_name, "department": d.department} for d in docs]


@app.get("/doctor/appointments/{appointment_id}", response_model=DoctorAppointmentDetailResponse)
def doctor_get_appointment_detail(
    appointment_id: int,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile not found")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    p = db.query(Patient).filter(Patient.id == appt.patient_id).first()
    doc = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first() if appt.doctor_id else None

    return DoctorAppointmentDetailResponse(
        appointment_id=appt.id,
        created_at=appt.created_at,
        status=appt.status,  # type: ignore[arg-type]
        patient_name=p.full_name if p else "Unknown",
        department=appt.department,
        priority=appt.priority,  # type: ignore[arg-type]
        severity=appt.severity_score,
        queue_position=appt.queue_position,
        predicted_wait_minutes=appt.predicted_wait_minutes,
        assigned_doctor=doc.full_name if doc else None,
        symptoms=appt.symptoms,
    )


@app.put("/doctor/appointments/{appointment_id}")
def doctor_update_appointment(
    appointment_id: int,
    req: DoctorUpdateAppointmentRequest,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile not found")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    appt.department = req.department
    appt.queue_position = int(req.queue_position)
    appt.predicted_wait_minutes = int(req.predicted_wait_minutes)
    appt.severity_score = int(req.severity)
    appt.priority = str(req.priority)

    db.add(appt)
    db.commit()
    return {"message": "updated", "appointment_id": appt.id}


@app.post("/doctor/appointments/{appointment_id}/complete")
def doctor_complete_appointment(
    appointment_id: int,
    _: DoctorCompleteAppointmentRequest,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile not found")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    appt.status = "Completed"
    appt.completed_at = now_utc()
    db.add(appt)
    db.commit()
    return {"message": "completed", "appointment_id": appt.id}


@app.post("/doctor/appointments/{appointment_id}/manual_reassign")
def doctor_manual_reassign(
    appointment_id: int,
    req: DoctorManualReassignRequest,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="Doctor profile not found")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    new_doc = db.query(Doctor).filter(Doctor.id == req.doctor_id).first()
    if not new_doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    appt.doctor_id = new_doc.id
    appt.department = new_doc.department

    db.add(appt)
    db.commit()
    return {
        "message": "reassigned",
        "appointment_id": appt.id,
        "new_doctor": new_doc.full_name,
        "department": new_doc.department,
    }