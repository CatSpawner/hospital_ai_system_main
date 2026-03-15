document.addEventListener("DOMContentLoaded", () => {
  const patientToggle = $("patientToggle");
  const doctorToggle = $("doctorToggle");
  const roleField = $("roleField");

  const loginOut = $("loginOut");
  const registerOut = $("registerOut");

  const openRegisterBtn = $("openRegisterBtn");
  const registerModal = $("registerModal");
  const closeRegisterBtn = $("closeRegisterBtn");
  const cancelRegisterBtn = $("cancelRegisterBtn");

  function currentRole() {
    return roleField?.value || getRole() || "patient";
  }

  function setActive(role) {
    roleField.value = role;
    setRole(role);

    patientToggle.classList.toggle("active", role === "patient");
    doctorToggle.classList.toggle("active", role === "doctor");

    if (openRegisterBtn) openRegisterBtn.style.display = role === "patient" ? "inline-flex" : "none";
  }

  function openModal() {
    setText(registerOut, "");
    registerModal.classList.add("open");
    registerModal.setAttribute("aria-hidden", "false");
    const first = registerModal.querySelector("input[name='full_name']");
    if (first) first.focus();
  }

  function closeModal() {
    registerModal.classList.remove("open");
    registerModal.setAttribute("aria-hidden", "true");
  }

  patientToggle.addEventListener("click", () => setActive("patient"));
  doctorToggle.addEventListener("click", () => setActive("doctor"));
  setActive(getRole() || "patient");

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setText(loginOut, "");
    try {
      const payload = formToJson(e.target);
      const data = await api("/login", { method: "POST", body: JSON.stringify(payload) });

      setToken(data.access_token);
      setRole(payload.role);
      refreshState();

      HospitalPopup.success("Login successful", `Logged in as ${payload.role}.`, {
        subtitle: "Redirecting…",
        autoCloseMs: 900,
      });

      setTimeout(() => {
        window.location.href = payload.role === "patient" ? "/patient" : "/doctor";
      }, 650);
    } catch (err) {
      HospitalPopup.error("Login failed", String(err), {
        subtitle: "Check username/password and selected role.",
      });
      setText(loginOut, String(err));
    }
  });

  openRegisterBtn?.addEventListener("click", () => {
    if (currentRole() !== "patient") {
      HospitalPopup.warning("Registration unavailable", "Registration is only for patients. Please select Patient.");
      setText(loginOut, "Registration is only for patients. Please select Patient.");
      return;
    }
    openModal();
  });

  closeRegisterBtn?.addEventListener("click", closeModal);
  cancelRegisterBtn?.addEventListener("click", closeModal);
  registerModal?.addEventListener("click", (e) => { if (e.target === registerModal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && registerModal.classList.contains("open")) closeModal(); });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    setText(registerOut, "");
    try {
      const payload = formToJson(e.target);

      await api("/register/patient", { method: "POST", body: JSON.stringify(payload) });

      const loginPayload = { username: payload.username, password: payload.password, role: "patient" };
      const token = await api("/login", { method: "POST", body: JSON.stringify(loginPayload) });

      setToken(token.access_token);
      setRole("patient");
      refreshState();

      closeModal();

      HospitalPopup.success("Account created", "Registration complete. Logging you in…", { autoCloseMs: 1100 });

      setTimeout(() => {
        window.location.href = "/patient";
      }, 750);
    } catch (err) {
      HospitalPopup.error("Registration failed", String(err));
      setText(registerOut, String(err));
    }
  });
});