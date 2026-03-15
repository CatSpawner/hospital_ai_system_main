function renderPatientCards(data) {
  const wrap = document.createElement("div");
  wrap.className = "cards";

  if (!data.appointments || data.appointments.length === 0) {
    const d = document.createElement("div");
    d.className = "item";
    d.textContent = "No submissions yet.";
    wrap.appendChild(d);
    return wrap;
  }

  for (const a of data.appointments) {
    const item = document.createElement("div");
    item.className = "item";

    const top = document.createElement("div");
    top.className = "itemTop";

    const left = document.createElement("div");
    left.innerHTML = `
      <div style="font-weight:900;">Appointment #${a.appointment_id}</div>
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
      <div><div class="k">Doctor</div><div class="v">${a.assigned_doctor || "Not assigned"}</div></div>
      <div><div class="k">Queue position</div><div class="v">${a.queue_position}</div></div>
      <div><div class="k">Estimated wait</div><div class="v">${a.estimated_waiting_time_minutes} min</div></div>
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
  const submitOut = $("submitOut");
  const dashCards = $("dashCards");
  const tip = $("patientTip");

  function ensureLoggedInPatient() {
    const token = getToken();
    const role = getRole();
    if (!token) throw new Error("Please login first from Home page.");
    if (role !== "patient") throw new Error("Please login as Patient from Home page.");
  }

  async function loadDash() {
    dashCards.innerHTML = "";
    try {
      ensureLoggedInPatient();
      const data = await api("/patient/dashboard");
      tip.textContent = data.tip || "";
      dashCards.appendChild(renderPatientCards(data));
      notice.style.display = "none";
    } catch (err) {
      notice.style.display = "block";
      notice.textContent = String(err);
      HospitalPopup.error("Cannot load dashboard", String(err));
    }
  }

  $("submitForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setText(submitOut, "");
    try {
      ensureLoggedInPatient();
      const payload = formToJson(e.target);
      const data = await api("/patient/submit", { method: "POST", body: JSON.stringify(payload) });

      HospitalPopup.result("Submission received", {
        "Assigned Doctor": data.assigned_doctor || "Not assigned",
        "Department": data.department,
        "Severity": `${data.severity}/10`,
        "Priority": data.priority,
        "Queue position": String(data.queue_position),
        "Estimated wait": `${data.estimated_waiting_time_minutes} min`,
        "Status": data.status
      }, { subtitle: "Please wait for your turn. You can refresh status anytime." });

      setText(
        submitOut,
        `Submitted successfully.\nAssigned Doctor: ${data.assigned_doctor}\nDepartment: ${data.department}`
      );

      await loadDash();
    } catch (err) {
      HospitalPopup.error("Submission failed", String(err));
      setText(submitOut, String(err));
    }
  });

  $("dashBtn").addEventListener("click", () => {
    HospitalPopup.info("Refreshing", "Updating your status…", { autoCloseMs: 900 });
    loadDash();
  });

  loadDash();
});