(function () {
  const ROOT_ID = "hs-popup-root";
  const TYPES = new Set(["info", "success", "warning", "error", "result", "confirm"]);

  function ensureDom() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "hs-popup-root hs-type-info";
    root.hidden = true;

    root.innerHTML = `
      <div class="hs-popup-backdrop" data-hs-close></div>

      <div class="hs-popup" role="dialog" aria-modal="true" aria-labelledby="hs-popup-title" aria-describedby="hs-popup-subtitle">
        <div class="hs-popup-head">
          <div class="hs-popup-icon" aria-hidden="true"></div>

          <div class="hs-popup-titles">
            <div id="hs-popup-title" class="hs-popup-title">Title</div>
            <div id="hs-popup-subtitle" class="hs-popup-subtitle"></div>
          </div>

          <button class="hs-popup-x" type="button" aria-label="Close" data-hs-close>×</button>
        </div>

        <div class="hs-popup-body">
          <div id="hs-popup-content" class="hs-popup-content"></div>
        </div>

        <div class="hs-popup-foot">
          <div id="hs-popup-foot-left" class="hs-popup-foot-left"></div>
          <div id="hs-popup-foot-right" class="hs-popup-foot-right"></div>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    return root;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeType(type) {
    const t = String(type || "info").toLowerCase();
    return TYPES.has(t) ? t : "info";
  }

  function setType(root, type) {
    for (const t of TYPES) root.classList.remove(`hs-type-${t}`);
    root.classList.add(`hs-type-${type}`);
  }

  function clearFooter(root) {
    root.querySelector("#hs-popup-foot-left").innerHTML = "";
    root.querySelector("#hs-popup-foot-right").innerHTML = "";
  }

  function addBtn(container, spec) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `hs-btn ${spec.variant || ""}`.trim();
    b.textContent = spec.label || "OK";
    b.addEventListener("click", async () => {
      try {
        if (spec.onClick) await spec.onClick();
      } finally {
        if (spec.autoClose !== false) HospitalPopup.close();
      }
    });
    container.appendChild(b);
    return b;
  }

  let lastFocused = null;

  function trapFocus(root) {
    const dialog = root.querySelector(".hs-popup");
    const focusables = dialog.querySelectorAll(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    function onKey(e) {
      if (e.key === "Escape") HospitalPopup.close();
      if (e.key !== "Tab") return;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    root.__hsKeyHandler = onKey;
    document.addEventListener("keydown", onKey);
    first.focus();
  }

  function releaseFocus(root) {
    if (root?.__hsKeyHandler) {
      document.removeEventListener("keydown", root.__hsKeyHandler);
      root.__hsKeyHandler = null;
    }
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    lastFocused = null;
  }

  function defaultTitle(type) {
    switch (type) {
      case "success": return "Completed";
      case "warning": return "Please Review";
      case "error": return "Action Needed";
      case "result": return "Result";
      case "confirm": return "Confirm";
      default: return "Information";
    }
  }

  function defaultButtons(type, opts) {
    if (type === "confirm") {
      return [
        { label: opts?.cancelLabel || "Cancel", variant: "subtle", align: "right" },
        { label: opts?.confirmLabel || "Confirm", variant: "primary", align: "right", onClick: opts?.onConfirm },
      ];
    }
    return [{ label: "OK", variant: "primary", align: "right" }];
  }

  function render(opts) {
    const root = ensureDom();
    const type = normalizeType(opts?.type);

    lastFocused = document.activeElement;

    setType(root, type);

    const title = root.querySelector("#hs-popup-title");
    const subtitle = root.querySelector("#hs-popup-subtitle");
    const content = root.querySelector("#hs-popup-content");

    title.textContent = opts?.title || defaultTitle(type);
    subtitle.textContent = opts?.subtitle || "";

    if (opts?.kv && typeof opts.kv === "object") {
      const rows = Object.entries(opts.kv)
        .map(([k, v]) => `<div class="hs-k">${escapeHtml(k)}</div><div class="hs-v">${escapeHtml(v)}</div>`)
        .join("");
      content.innerHTML = `<div class="hs-kv">${rows}</div>`;
    } else if (opts?.codeBlock != null) {
      content.innerHTML = `<pre class="hs-pre"><code>${escapeHtml(opts.codeBlock)}</code></pre>`;
    } else if (opts?.html != null) {
      content.innerHTML = String(opts.html);
    } else if (opts?.message != null) {
      content.innerHTML = `<div class="hs-msg">${escapeHtml(opts.message)}</div>`;
    } else {
      content.innerHTML = "";
    }

    clearFooter(root);

    const L = root.querySelector("#hs-popup-foot-left");
    const R = root.querySelector("#hs-popup-foot-right");

    const buttons = Array.isArray(opts?.buttons) ? opts.buttons : defaultButtons(type, opts);
    for (const b of buttons) addBtn(b.align === "left" ? L : R, b);

    root.querySelectorAll("[data-hs-close]").forEach((el) => (el.onclick = () => HospitalPopup.close()));

    root.hidden = false;
    trapFocus(root);

    if (opts?.autoCloseMs && Number.isFinite(opts.autoCloseMs) && opts.autoCloseMs > 0) {
      root.__hsTimer && clearTimeout(root.__hsTimer);
      root.__hsTimer = setTimeout(() => HospitalPopup.close(), opts.autoCloseMs);
    }

    return true;
  }

  function close() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.hidden = true;
    root.__hsTimer && clearTimeout(root.__hsTimer);
    root.__hsTimer = null;
    releaseFocus(root);
  }

  const HospitalPopup = {
    open: (opts) => render(opts),
    close,

    info: (title, message, extra = {}) => render({ type: "info", title, message, ...extra }),
    success: (title, message, extra = {}) =>
      render({ type: "success", title, message, autoCloseMs: extra.autoCloseMs ?? 2400, ...extra }),
    warning: (title, message, extra = {}) => render({ type: "warning", title, message, ...extra }),
    error: (title, message, extra = {}) => render({ type: "error", title, message, ...extra }),
    result: (title, kvOrMsg, extra = {}) => {
      const isObj = kvOrMsg && typeof kvOrMsg === "object" && !Array.isArray(kvOrMsg);
      return isObj
        ? render({ type: "result", title, kv: kvOrMsg, ...extra })
        : render({ type: "result", title, message: kvOrMsg, ...extra });
    },
    confirm: (title, message, onConfirm, extra = {}) =>
      render({ type: "confirm", title, message, onConfirm, ...extra }),
  };

  window.HospitalPopup = HospitalPopup;

  window.__hs_original_alert = window.alert;
  window.alert = function (msg) {
    HospitalPopup.info("Notice", String(msg));
  };
})();