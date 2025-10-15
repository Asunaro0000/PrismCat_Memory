// bgm-toggle.js — Phase1-5 共通 BGM ON/OFF
(() => {
  const PHASE = (() => {
    const m = /phase(\d+)\.html$/i.exec(location.pathname);
    return m ? Number(m[1]) : NaN;
  })();

  // 候補のファイル名（存在チェックはブラウザ任せ）
  const CANDIDATES = (n) => [
    `../assets/bgm/phase${n}.mp3`,
    `../assets/bgm/phase${n}_loop.mp3`,
    `../assets/bgm/phase${n}/bgm.mp3`,
    `/assets/bgm/phase${n}.mp3`,
  ];

  // 生成：<audio> と トグルボタン
  function ensureAudioAndButton() {
    // audio
    let a = document.getElementById('bgm');
    if (!a) {
      a = document.createElement('audio');
      a.id = 'bgm';
      a.preload = 'none';
      a.loop = true;
      a.crossOrigin = 'anonymous';
      document.body.appendChild(a);
    }

    // ボタン（トップバーの右側になければ作る）
    const topbar = document.querySelector('.topbar .right') || document.querySelector('.topbar');
    let btn = document.getElementById('bgmToggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'bgmToggle';
      btn.className = 'btn small';
      btn.type = 'button';
      btn.style.marginLeft = '8px';
      topbar?.appendChild(btn);
    }
    return { a, btn };
  }

  // 見た目更新
  async function updateUI(btn, a) {
    const on = !a.paused && !a.ended && a.currentTime > 0;
    btn.textContent = on ? 'BGM OFF' : 'BGM ON';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // srcセット（最初の一回だけ）
  function ensureSrc(a) {
    if (a.src) return;
    if (!Number.isFinite(PHASE)) return;
    const list = CANDIDATES(PHASE);
    // 最初の候補をセット（404でも play() 時に次候補へ切替）
    a.src = list[0];
    let idx = 0;
    a.addEventListener('error', () => {
      idx++;
      if (idx < list.length) a.src = list[idx];
    }, { once: false });
  }

  // ボタン押下
  async function onToggle(btn, a) {
    // クリック＝ユーザー操作なのでオートプレイ規制を満たす
    ensureSrc(a);
    try {
      if (a.paused) {
        await a.play();
        localStorage.setItem('bgmEnabled', '1');
      } else {
        a.pause();
        localStorage.setItem('bgmEnabled', '0');
      }
    } catch (e) {
      // 再生失敗時は一旦止めておく
      a.pause();
      console.debug('[BGM] play failed:', e);
    } finally {
      updateUI(btn, a);
    }
  }

  // ページ復帰時の暴走防止（iOS対策）
  document.addEventListener('visibilitychange', () => {
    const a = document.getElementById('bgm');
    if (!a) return;
    if (document.hidden) a.pause();
  });

  // 初期化
  window.addEventListener('DOMContentLoaded', () => {
    const { a, btn } = ensureAudioAndButton();


   // ★初回は必ず「BGM OFF」表示に固定（実際は無音のまま）
   btn.textContent = 'BGM OFF';
   btn.setAttribute('aria-pressed', 'false');

    btn.addEventListener('click', () => onToggle(btn, a));
  }, { once: true });
})();
