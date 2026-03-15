function $(id) { return document.getElementById(id); }

function getToken() { return localStorage.getItem("jwt_token") || ""; }
function setToken(t) { localStorage.setItem("jwt_token", t); }
function clearToken() { localStorage.removeItem("jwt_token"); }

function getRole() { return localStorage.getItem("jwt_role") || ""; }
function setRole(r) { localStorage.setItem("jwt_role", r); }
function clearRole() { localStorage.removeItem("jwt_role"); }

function refreshState() {
  const t = getToken();
  const tokenState = $("tokenState");
  const roleState = $("roleState");
  if (tokenState) tokenState.textContent = t ? (t.slice(0, 16) + "…" + t.slice(-10)) : "(none)";
  if (roleState) roleState.textContent = getRole() || "(unknown)";
}

async function api(path, opts = {}) {
  const headers = opts.headers || {};
  headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(path, { ...opts, headers });
  const txt = await res.text();

  let data;
  try { data = JSON.parse(txt); }
  catch { data = { raw: txt }; }

  if (!res.ok) {
    const msg = data && data.detail ? data.detail : ("HTTP " + res.status);
    throw new Error(String(msg));
  }
  return data;
}

function formToJson(form) {
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) obj[k] = v;
  return obj;
}

function setText(el, value) { if (el) el.textContent = value; }

function badgeClass(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "emergency" || p === "high") return "bad";
  if (p === "medium") return "warn";
  return "good";
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString(); }
  catch { return String(iso); }
}

function doLogout() {
  clearToken();
  clearRole();
  window.location.href = "/";
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
  refreshState();
});