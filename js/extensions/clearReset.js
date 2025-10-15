// /js/extensions/clearReset.js
(() => {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // どのキーを消すか：このパターンにマッチするlocalStorageキーを対象にする
  const KEY_PATTERNS = [
    /^albumPhase_\d+$/i,           // 例: albumPhase_1, albumPhase_2 ...
    /^phase\d+[:._-]?cleared$/i,   // 例: phase1:cleared, phase2_cleared
    /^phase\d+[:._-]?progress$/i,  // 例: phase1:progress
    /^phase[:._-]?cleared$/i,      // 例: phase:cleared
    /^memory[:._-]?game[:._-]?cleared$/i,  // 例: memory-game-cleared
    /^pairs[:._-]?best(Time|time)?$/i,     // 例: pairsBestTime
    /^best(Time|time)$/i,
    /^cleared$/i,
  ];

  function pickResetKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (KEY_PATTERNS.some((re) => re.test(k))) keys.push(k);
    }
    // 念のため album っぽいものも候補に（重複は削除）
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/album|phase|clear/i.test(k) && !keys.includes(k)) keys.push(k);
    }
    return Array.from(new Set(keys)).sort();
  }

  function backupAndReset(keys) {


    // 2) 削除
    keys.forEach((k) => localStorage.removeItem(k));

    // 3) セッション系も掃除（影響範囲は最小限）
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (/album|phase|clear/i.test(k)) sessionStorage.removeItem(k);
      }
    } catch {}

    // 4) 完了
    alert("クリア状態をリセットしました。ページを再読み込みします。");
    location.reload();
  }

  function makeButton() {
    const btn = document.createElement("button");
    btn.textContent = "クリア状態リセット";
    btn.className = "reset-clear-btn";
    btn.title = "ローカルに保存されたクリア状態を初期化します（バックアップを保存してから削除）";
    btn.addEventListener("click", () => {
      const keys = pickResetKeys();
      const msg = [
        "以下のキーをバックアップ後に削除します。",
        "",
        ...keys.slice(0, 12).map((k) => `• ${k}`),
        keys.length > 12 ? `…ほか ${keys.length - 12} 件` : "",
        "",
        "よろしいですか？",
      ].join("\n");
      if (!keys.length) {
        alert("削除対象のキーは見つかりませんでした。");
        return;
      }
      if (confirm(msg)) backupAndReset(keys);
    });
    return btn;
  }

  function injectButton() {
    // 既存のトップバーがあればそこに、なければ右上固定で
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
