/* ==========================================================
   phase-end.js (event-driven final)
   core.js が prismcat:phase-complete を発火すると：
   1) BGMをフェードアウト
   2) 「アルバムが開放されました。」のメッセージを表示
   3) クリックで index.html#album-phaseN に戻る
========================================================== */
(() => {
  if (window.PhaseEnd) return;

  const ALBUM_URL = "../index.html";
  const FADE_MS = 1200;
  const MESSAGE = "アルバムが開放されました。";
  const CLICK_HINT = "クリックで戻る";

  // --- BGMフェード ---
  function fadeOutBGM(ms = FADE_MS) {
    const tag = document.querySelector("audio#bgm, audio[data-bgm], audio.bgm");
    if (tag && !tag.paused) {
      const start = tag.volume ?? 1;
      const t0 = performance.now();
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        tag.volume = Math.max(0, start * (1 - k));
        if (k < 1) requestAnimationFrame(tick);
        else try { tag.pause(); } catch {}
      };
      requestAnimationFrame(tick);
      return;
    }
    if (window.__bgm && typeof window.__bgm.fade === "function") {
      try {
        const vol = typeof window.__bgm.volume === "function" ? window.__bgm.volume() : 1;
        window.__bgm.fade(vol, 0, ms);
        setTimeout(() => { if (typeof window.__bgm.pause === "function") window.__bgm.pause(); }, ms + 50);
      } catch {}
    }
  }

  // --- オーバーレイ生成 ---
  function showOverlay(phase = 1) {
    fadeOutBGM(FADE_MS);

    const albumHref = `${ALBUM_URL}#album-phase${phase}`;
    const wrap = document.createElement("div");
    wrap.id = "phaseEndOverlay";
    wrap.className = "phase-end overlay hide";
    wrap.innerHTML = `
      <div class="veil"></div>
      <div class="panel">
        <div class="message">${MESSAGE}</div>
        <div class="hint">${CLICK_HINT}</div>
      </div>
    `;
    document.body.appendChild(wrap);

    requestAnimationFrame(() => wrap.classList.remove("hide"));
    wrap.addEventListener(
      "click",
      () => {
        document.body.classList.add("fade-out");
        setTimeout(() => { location.href = albumHref; }, 600);
      },
      { once: true }
    );
  }

  // --- イベント受信：core.js からの通知を待つ ---
  window.addEventListener("prismcat:phase-complete", (ev) => {
    const phase = ev.detail?.phase ?? 1;
    console.log("[PhaseEnd] phase-complete detected:", phase);
    showOverlay(phase);
  });

  console.log("[PhaseEnd] event listener active");
})();
