// js/extensions/pair-match-caption.js
(() => {
  const DURATION = 2500;
  const strip = s => String(s).replace(/^Phase\s*\d+：[^｜]*\｜/, '').trim();

  function host() {
    let el = document.getElementById('miniCaption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'miniCaption';
      Object.assign(el.style, {
        position:'fixed', left:'50%', bottom:'8%', transform:'translateX(-50%)',
        padding:'10px 14px', borderRadius:'10px',
        background:'rgba(0,0,0,.55)', color:'#fff', fontSize:'14px',
        letterSpacing:'.03em', pointerEvents:'none', zIndex:9999,
        opacity:0, transition:'opacity .22s ease'
      });
      document.body.appendChild(el);
    }
    return el;
  }
  function show(text) {
    const el = host();
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(el._tid);
    el._tid = setTimeout(() => { el.style.opacity = '0'; }, DURATION);
  }

  // イベント受信
  window.addEventListener('prismcat:pair-match', (ev) => {
    const { phase=1, matched=1 } = ev.detail || {};
    const map = (window.CAPTION_MAP || {})[phase];
    if (!map) return;
    const raw = map[matched];          // 例: CAPTION_MAP[1][3]
    if (!raw) return;
    show(strip(raw));                  // 「Phase〜｜」の前置きを剥いで表示
  });

  console.log('[pair-match-caption] ready (uses window.CAPTION_MAP)');
})();
