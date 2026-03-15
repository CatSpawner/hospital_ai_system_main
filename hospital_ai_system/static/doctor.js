function renderDoctorCards(data, onOpen) {
  const wrap = document.createElement("div");
  wrap.className = "cards";

  if (!data.assigned_patients || data.assigned_patients.length === 0) {
    const d = document.createElement("div");
    d.className = "item";
    d.style.cursor = "default";
    d.textContent = "No waiting patients assigned.";
    wrap.appendChild(d);
    return wrap;
  }

  for (const a of data.assigned_patients) {
    const item = document.createElement("div");
    item.className = "item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", "Open patient details");
    item.addEventListener("click", () => onOpen(a.appointment_id));
    item.addEventListener("keydown", (e) => { if (e.key === "Enter") onOpen(a.appointment_id); });

    const top = document.createElement("div");
    top.className = "itemTop";

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:900;">#${a.appointment_id} • ${a.patient_name}</div>
      <div class="muted" style="font-size:12px;">${fmtDate(a.created_at)}</div>
    `;

    const badge = document.createElement("div");
    badge.className = `badge ${badgeClass(a.priority)}`;
    badge.textContent = `${a.status} • ${a.priority}`;

    top.appendChild(left);
    top.appendChild(badge);

    const kv = document.createElement("div");
    kv.className = "kv2";
    kv.innerHTML = `
      <div><div class="k">Department</div><div class="v">${a.department}</div></div>
      <div><div class="k">Queue position</div><div class="v">${a.queue_position}</div></div>
      <div><div class="k">Predicted wait</div><div class="v">${a.predicted_wait_minutes} min</div></div>
      <div><div class="k">Severity</div><div class="v">${a.severity}/10</div></div>
    `;

    item.appendChild(top);
    item.appendChild(kv);
    wrap.appendChild(item);
  }

  return wrap;
}

document.addEventListener("DOMContentLoaded", () => {
  const notice = $("mustLoginNotice");
  const dashCards = $("dashCards");

  const patientModal = $("patientModal");
  const closePatientModalBtn = $("closePatientModalBtn");
  const closePatientModalBtn2 = $("closePatientModalBtn2");
  const patientDetailOut = $("patientDetailOut");
  const patientModalSub = $("patientModalSub");

  const updateApptForm = $("updateApptForm");
  const updateOut = $("updateOut");
  const completeCheckbox = $("completeCheckbox");

  const manualReassignForm = $("manualReassignForm");
  const manualReassignOut = $("manualReassignOut");
  const mrDoctorSelect = $("mr_doctor_id");

  let cachedDoctors = [];

  function ensureLoggedInDoctor() {
    const token = getToken();
    const role = getRole();
    if (!token) throw new Error("Please login first from Home page.");
    if (role !== "doctor") throw new Error("Please login as Doctor from Home page.");
  }

  function openModal() {
    patientModal.classList.add("open");
    patientModal.setAttribute("aria-hidden", "false");
  }
  function closeModal() {
    patientModal.classList.remove("open");
    patientModal.setAttribute("aria-hidden", "true");
  }

  closePatientModalBtn?.addEventListener("click", closeModal);
  closePatientModalBtn2?.addEventListener("click", closeModal);
  patientModal?.addEventListener("click", (e) => { if (e.target === patientModal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && patientModal.classList.contains("open")) closeModal(); });

  function populateDoctorList(selectedDoctorName) {
    mrDoctorSelect.innerHTML = "";
    for (const d of cachedDoctors) {
      const opt = document.createElement("option");
      opt.value = String(d.id);
      opt.textContent = `${d.full_name} — ${d.department}`;
      if (selectedDoctorName && d.full_name === selectedDoctorName) opt.selected = true;
      mrDoctorSelect.appendChild(opt);
    }
  }

  async function loadDoctorListOnce() {
    if (cachedDoctors.length > 0) return;
    cachedDoctors = await api("/doctor/doctors");
  }

  async function loadDash() {
    dashCards.innerHTML = "";
    try {
      ensureLoggedInDoctor();
      const data = await api("/doctor/dashboard");
      dashCards.appendChild(renderDoctorCards(data, openAppointment));
      notice.style.display = "none";
    } catch (err) {
      notice.style.display = "block";
      notice.textContent = String(err);
      HospitalPopup.error("Cannot load doctor dashboard", String(err));
    }
  }

  async function openAppointment(appointmentId) {
    setText(patientDetailOut, "");
    setText(updateOut, "");
    setText(manualReassignOut, "");
    completeCheckbox.checked = false;

    try {
      ensureLoggedInDoctor();
      await loadDoctorListOnce();

      const d = await api(`/doctor/appointments/${appointmentId}`);

      patientModalSub.textContent = `Appointment #${d.appointment_id} • ${d.patient_name}`;

      setText(
        patientDetailOut,
        `Symptoms (patient entered):\n\n${d.symptoms}\n\nAssigned doctor: ${d.assigned_doctor || "Not assigned"}\nStatus: ${d.status}\nCreated: ${fmtDate(d.created_at)}`
      );

      $("upd_appointment_id").value = String(d.appointment_id);
      $("upd_department").value = d.department;
      $("upd_queue_position").value = String(d.queue_position);
      $("upd_predicted_wait_minutes").value = String(d.predicted_wait_minutes);
      $("upd_severity").value = String(d.severity);
      $("upd_priority").value = String(d.priority);

      $("mr_appointment_id").value = String(d.appointment_id);
      populateDoctorList(d.assigned_doctor || "");

      openModal();

      HospitalPopup.info("Appointment opened", `Appointment #${d.appointment_id} loaded.`, {
        subtitle: "Update values, mark completed, or reassign.",
        autoCloseMs: 1200
      });
    } catch (err) {
      HospitalPopup.error("Cannot open appointment", String(err));
    }
  }

  updateApptForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setText(updateOut, "");
    try {
      ensureLoggedInDoctor();

      const apptId = Number($("upd_appointment_id").value);
      const payload = {
        department: $("upd_department").value,
        queue_position: Number($("upd_queue_position").value),
        predicted_wait_minutes: Number($("upd_predicted_wait_minutes").value),
        severity: Number($("upd_severity").value),
        priority: $("upd_priority").value
      };

      await api(`/doctor/appointments/${apptId}`, { method: "PUT", body: JSON.stringify(payload) });

      if (completeCheckbox.checked) {
        await api(`/doctor/appointments/${apptId}/complete`, { method: "POST", body: JSON.stringify({ completed: true }) });
        setText(updateOut, "Saved and marked as Completed.");
        HospitalPopup.success("Saved", "Appointment updated and marked as Completed.");
      } else {
        setText(updateOut, "Saved changes successfully.");
        HospitalPopup.success("Saved", "Appointment updated successfully.");
      }

      await loadDash();
    } catch (err) {
      HospitalPopup.error("Update failed", String(err));
      setText(updateOut, String(err));
    }
  });

  manualReassignForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setText(manualReassignOut, "");
    try {
      ensureLoggedInDoctor();

      const apptId = Number($("mr_appointment_id").value);
      const doctorId = Number($("mr_doctor_id").value);

      const r = await api(`/doctor/appointments/${apptId}/manual_reassign`, {
        method: "POST",
        body: JSON.stringify({ doctor_id: doctorId }),
      });

      setText(manualReassignOut, `Reassigned to: ${r.new_doctor}\nDepartment: ${r.department}`);

      HospitalPopup.result("Reassigned", {
        "Appointment": `#${apptId}`,
        "New doctor": r.new_doctor,
        "Department": r.department
      }, { subtitle: "Dashboard will refresh." });

      await loadDash();
      await openAppointment(apptId);
    } catch (err) {
      HospitalPopup.error("Reassign failed", String(err));
      setText(manualReassignOut, String(err));
    }
  });

  $("dashBtn")?.addEventListener("click", () => {
    HospitalPopup.info("Refreshing", "Updating doctor dashboard…", { autoCloseMs: 900 });
    loadDash();
  });

  loadDash();
});