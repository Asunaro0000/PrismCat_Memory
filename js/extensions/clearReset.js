// /js/extensions/clearReset.js
(() => {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // Which keys to clear: target localStorage keys matching these patterns
  const KEY_PATTERNS = [
    /^albumPhase_\d+$/i,
    /^phase\d+[:._-]?cleared$/i,
    /^phase\d+[:._-]?progress$/i,
    /^phase[:._-]?cleared$/i,
    /^memory[:._-]?game[:._-]?cleared$/i,
    /^pairs[:._-]?best(Time|time)?$/i,
    /^best(Time|time)$/i,
    /^cleared$/i,
  ];

  function pickResetKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (KEY_PATTERNS.some((re) => re.test(k))) keys.push(k);
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/album|phase|clear/i.test(k) && !keys.includes(k)) keys.push(k);
    }
    return Array.from(new Set(keys)).sort();
  }

  function backupAndReset(keys) {
    // 2) Delete
    keys.forEach((k) => localStorage.removeItem(k));

    // 3) Clean related sessionStorage keys (limited scope)
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (/album|phase|clear/i.test(k)) sessionStorage.removeItem(k);
      }
    } catch {}

    // 4) Done
    alert("Cleared progress has been reset. The page will now reload.");
    location.reload();
  }

  function makeButton() {
    const btn = document.createElement("button");
    btn.textContent = "Reset Progress";
    btn.className = "reset-clear-btn";
    btn.title =
      "Reset locally saved progress data (it will back up and then delete matched keys).";
    btn.addEventListener("click", () => {
      const keys = pickResetKeys();
      const msg = [
        "The following keys will be backed up and then deleted:",
        "",
        ...keys.slice(0, 12).map((k) => `• ${k}`),
        keys.length > 12 ? `…and ${keys.length - 12} more` : "",
        "",
        "Do you want to continue?",
      ].join("\n");
      if (!keys.length) {
        alert("No matching keys found to delete.");
        return;
      }
      if (confirm(msg)) backupAndReset(keys);
    });
    return btn;
  }

  function injectButton() {
    const topbar =
      document.querySelector(".topbar") ||
      document.querySelector("header") ||
      null;

    const btn = makeButton();
    if (topbar) {
      const wrap = document.createElement("div");
      wrap.style.marginLeft = "auto";
      wrap.appendChild(btn);
      topbar.appendChild(wrap);
    } else {
      btn.style.position = "fixed";
      btn.style.top = "12px";
      btn.style.right = "12px";
      document.body.appendChild(btn);
    }
  }

  ready(injectButton);
})();
