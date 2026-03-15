# BARC Hospital, Mankhurd — Smart Triage & OPD Workflow (Demo)

Developer: **Aditi Devlekar**

A patient/doctor demo web app built with FastAPI:
- Single homepage login (Patient / Doctor)
- Patient registration via popup modal (homepage)
- Patient portal: submit symptoms, view appointment status
- Doctor portal: view assigned queue and manage appointments
- Offline triage rules (no external AI)
- SQLite database (local)

---

## UI Update (Centered Popups)

This version adds a **Hospital Popup System**:
- Every important output is shown as a **center-screen popup**
- Different styles for different output types:
  - info / success / warning / error / result / confirm
- Accessible: focus trap, ESC to close, click-backdrop to close (non-confirm popups)

---

## Medical UI / Safety Notes (Important)

- This app provides **general guidance only** and is **not a substitute** for professional medical advice.
- The UI includes an **emergency warning** encouraging urgent care for severe symptoms.
- The app avoids showing unnecessary sensitive data and redirects to home on logout.

---

## Requirements

- **Windows 10/11**
- **Python 3.12.x** recommended
- pip (latest)
- Browser: Chrome / Edge

Pinned libraries in `requirements.txt` include:
- fastapi `0.115.6`
- uvicorn `0.30.6`
- sqlalchemy `2.0.36`
- passlib `1.7.4`
- bcrypt `4.0.1` (important for passlib compatibility)

---

## Project Structure

```
hospital_ai_system/
  requirements.txt
  README.md
  hospital_ai_system/
    __init__.py
    main.py
    database.py
    models.py
    schemas.py
    auth.py
    triage.py
    templates/
      index.html
      patient.html
      doctor.html
    static/
      styles.css
      app.js
      popup.js
      home.js
      patient.js
      doctor.js
```

---

## Setup & Run (Windows)

```bat
cd /d E:\aditi\hospital_ai_system
py -3.12 -m venv venv
venv\Scripts\activate
python -m pip install -U pip
pip install -r requirements.txt
python -m uvicorn hospital_ai_system.main:app --host 127.0.0.1 --port 8000 --reload
```

Open:
- http://127.0.0.1:8000/

---

## Seeded Doctor Accounts

On first run, the app automatically creates demo doctors (if none exist).

**Password for all seeded doctors:** `Doctor@1234`

Usernames (Role: `doctor`):
- `dr_ashwini` — General Medicine
- `dr_rahul` — Cardiology
- `dr_meera` — Dermatology
- `dr_sanjay` — ENT
- `dr_neha` — Paediatrics
- `dr_priya` — Obstetrics & Gynaecology
- `dr_omkar` — Orthopaedics
- `dr_farhan` — Pulmonology
- `dr_kavita` — Ophthalmology
- `dr_vivek` — Dental
- `dr_anita` — Endocrinology
- `dr_rohit` — Nephrology
- `dr_emergency` — Emergency

---

## Reset Database (optional)

Stop the server and delete:
- `hospital_ai_system.db`

Then run again to recreate tables and re-seed doctors.