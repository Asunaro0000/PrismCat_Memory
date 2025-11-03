// /js/extensions/bgm-phase.js — GameSpec準拠の極小版
(function () {
  const onReady = (fn) =>
    (document.readyState === "loading")
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function derivePhaseId() {
    const m = location.pathname.toLowerCase().match(/phase(\d+)\.html$/);
    return m ? Number(m[1]) : null;
  }
  function prefix() { return location.pathname.includes("/phases/") ? "../" : "./"; }

  function fadeTo(audio, target = 0.6, ms = 800) {
    const start = clamp01(Number(audio.volume) || 0);
    const end   = clamp01(Number(target));
    const delta = end - start;
    const t0 = performance.now();
    function step(t) {
      const k = clamp01((t - t0) / ms);
      const v = clamp01(start + delta * k);
      try { audio.volume = v; } catch {}
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  onReady(async () => {
    const pid = derivePhaseId();
    if (!pid) return; // フェーズページ以外は何もしない

    // audio要素の用意
    const audio = document.getElementById("bgm") || (() => {
      const a = document.createElement("audio");
      a.id = "bgm"; a.preload = "auto"; a.loop = true; a.muted = true; a.volume = 0;
      document.body.appendChild(a);
      return a;
    })();

    // GameSpecからBGMパスを決定
    try {
      const spec = await fetch(prefix() + "GameSpec.json").then(r => r.json());
      const bgmBase = (spec?.assets?.bgmBase || "assets/bgm").replace(/^\.*\//, "");
      const ph = (spec?.phases || []).find(p => Number(p.id) === pid);
      if (!ph?.bgm) return;

      audio.src = `${prefix()}${bgmBase}/${ph.bgm}`;
    } catch {
      return; // BGMなしで続行
    }

    // 自動再生解除まではミュートで先にplayを投げる
    try { audio.muted = true; audio.volume = 0; audio.play().catch(() => {}); } catch {}

    const unlock = () => {
      try { audio.muted = false; } catch {}
      if (audio.paused) audio.play().catch(() => {});
      fadeTo(audio, 0.6, 900);
      window.removeEventListener("pointerdown", unlock, { passive: true });
      window.removeEventListener("keydown", unlock);
    };

    // ▼ ここから：イントロ完了後にだけ解禁イベントを張る
    // CSSカスタムプロパティ --phase{n}-ms を読み取り（s/ms対応）
    const readCssMs = (name) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!v) return 0;
      if (v.endsWith("ms")) return Number.parseFloat(v) || 0;
      if (v.endsWith("s"))  return (Number.parseFloat(v) || 0) * 1000;
      return Number(v) || 0;
    };
    const introMs = readCssMs(`--phase${pid}-ms`);
    const INTRO_BUFFER_MS = 200; // ほんの少し余韻を見てズレ防止

    const attachUnlock = () => {
      // 既存のタイミングは維持。登録対象だけ増やす（itch/モバイルの取りこぼし対策）
      window.addEventListener("pointerdown", unlock, { passive: true, once: true });
      window.addEventListener("keydown",    unlock, { once: true });
      // 追加（取りこぼし防止）
      window.addEventListener("click",    unlock, { capture: true, passive: true, once: true });
      window.addEventListener("touchend", unlock, { capture: true, passive: true, once: true });
      document.addEventListener("pointerdown", unlock, { capture: true, passive: true, once: true });
      document.addEventListener("click",       unlock, { capture: true, passive: true, once: true });
      document.addEventListener("touchend",    unlock, { capture: true, passive: true, once: true });
    };
    // イントロが終わるまで待ってからイベント登録
    setTimeout(attachUnlock, Math.max(0, introMs + INTRO_BUFFER_MS));

    // タブ離脱/復帰の音量処理
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        audio.dataset.prevVol = String(clamp01(Number(audio.volume) || 0));
        try { audio.volume = 0; } catch {}
      } else {
        let prev = Number(audio.dataset.prevVol ?? 0.6);
        if (!Number.isFinite(prev)) prev = 0.6;
        fadeTo(audio, prev, 600);
      }
    });

    // 退出時に静かに
    window.addEventListener("beforeunload", () => { try { audio.volume = 0; } catch {} });

    // デバッグ操作用
    window.__bgm = {
      el: audio,
      fade: (v = 0.6, ms = 800) => fadeTo(audio, v, ms),
      mute: () => { audio.muted = true; },
      unmute: () => { audio.muted = false; if (audio.paused) audio.play().catch(()=>{}); }
    };
  });
})();
