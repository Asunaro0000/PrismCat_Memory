// bg-pulse-bgm.js — __bgm ハンドル（bgm-phase.jsが置く）を使って微妙に光量を同期
(function(){
  const ready=(fn)=> document.readyState==="loading"
    ? document.addEventListener("DOMContentLoaded", fn, { once:true }) : fn();

  ready(()=>{
    const root = document.documentElement;
    let t = 0;
    function tick(){
      // 基本のゆらぎ
      t += 0.016; // ~60fps
      const base = 0.25 + 0.05*Math.sin(t*0.7) + 0.03*Math.sin(t*1.1+0.5);

      // BGMの現在音量を拾って寄与（安全クランプ済みのbgm-phase.js想定）
      const vol = (window.__bgm?.el?.volume ?? 0.6);
      const pulse = base + 0.12 * Math.min(1, Math.max(0, vol)); // 0–1

      root.style.setProperty('--bg-breathe', String(pulse));
      requestAnimationFrame(tick);
    }
    tick();

    // CSS側の after に反映（なければ無視）
    const s = document.createElement('style');
    s.textContent = `
      #bgFx::after{ opacity: var(--bg-breathe, .35) !important; }
    `;
    document.head.appendChild(s);
  });
})();

// audio-unlock-guard.js
(function(){
  // true になるまで「初回タップでの再生解放」を許可しない
  window.__BGM_UNLOCK_READY__ = false;

  // 画面ロード後 3 秒で解放許可
  window.addEventListener('load', () => {
    setTimeout(() => { window.__BGM_UNLOCK_READY__ = true; }, 3000);
  });

  // グローバル・ワンショットの解放ハンドラ（必要なら既存ハンドラより前に登録）
  const onFirstPointer = (ev) => {
    if (!window.__BGM_UNLOCK_READY__) {
      // 3秒経過前のタップは握りつぶす
      ev.stopImmediatePropagation?.();
      ev.stopPropagation?.();
      ev.preventDefault?.();
      return; // 何もしない
    }
    // 許可済みなら以降は通常の挙動へ（本ハンドラ自体は外す）
    window.removeEventListener('pointerdown', onFirstPointer, true);
  };

  // キャプチャ段階で先に食う（“true” がミソ）
  window.addEventListener('pointerdown', onFirstPointer, true);
})();
