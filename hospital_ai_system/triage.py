"""
Triage logic (offline heuristic rules)

Developer: Aditi Devlekar
"""
from __future__ import annotations

from typing import Dict


# BARC Hospital Mankhurd - simplified department mapping for demo
def triage(symptoms: str) -> Dict[str, object]:
    s = (symptoms or "").lower()

    # Emergency
    if any(k in s for k in ["chest pain", "heart attack", "stroke", "unconscious", "seizure", "severe bleeding"]):
        return {"department": "Emergency", "severity_score": 10, "priority": "Emergency"}

    if any(k in s for k in ["shortness of breath", "breathing", "accident", "burn", "fracture", "high fever"]):
        return {"department": "Emergency", "severity_score": 8, "priority": "High"}

    # Specialities
    if any(k in s for k in ["skin", "rash", "itch", "acne", "eczema", "psoriasis"]):
        return {"department": "Dermatology", "severity_score": 4, "priority": "Medium"}

    if any(k in s for k in ["pregnant", "pregnancy", "period", "menstrual", "gynae", "gyne", "bleeding"]):
        return {"department": "Obstetrics & Gynaecology", "severity_score": 6, "priority": "High"}

    if any(k in s for k in ["child", "baby", "infant", "vaccination", "pediatric", "paediatric"]):
        return {"department": "Paediatrics", "severity_score": 4, "priority": "Medium"}

    if any(k in s for k in ["tooth", "dental", "gum", "jaw", "cavity"]):
        return {"department": "Dental", "severity_score": 3, "priority": "Low"}

    if any(k in s for k in ["eye", "vision", "blur", "red eye", "itchy eye"]):
        return {"department": "Ophthalmology", "severity_score": 3, "priority": "Low"}

    if any(k in s for k in ["ear", "hearing", "throat", "tonsil", "sinus", "ent", "nose"]):
        return {"department": "ENT", "severity_score": 4, "priority": "Medium"}

    if any(k in s for k in ["diabetes", "thyroid", "hormone", "endocrine"]):
        return {"department": "Endocrinology", "severity_score": 5, "priority": "Medium"}

    if any(k in s for k in ["kidney", "urine", "uti", "burning urine", "stones"]):
        return {"department": "Nephrology", "severity_score": 5, "priority": "Medium"}

    if any(k in s for k in ["heart", "bp", "blood pressure", "palpitation"]):
        return {"department": "Cardiology", "severity_score": 6, "priority": "High"}

    if any(k in s for k in ["asthma", "cough", "lungs", "pneumonia"]):
        return {"department": "Pulmonology", "severity_score": 5, "priority": "Medium"}

    if any(k in s for k in ["bone", "joint", "knee", "back pain", "orthopedic", "orthopaedic"]):
        return {"department": "Orthopaedics", "severity_score": 5, "priority": "Medium"}

    # Default
    if any(k in s for k in ["cold", "cough", "fever", "headache", "vomit", "nausea", "stomach", "fatigue"]):
        return {"department": "General Medicine", "severity_score": 4, "priority": "Medium"}

    return {"department": "General Medicine", "severity_score": 3, "priority": "Low"}