/* =========================================================================
 * bundle.albumStore.js — albumGrid hard-kill / Phase=1..5 / 横スクロール
 * ★画像を必ず正方形(既定 90x90)にフィットさせる強制CSS付き★
 * ========================================================================= */
(() => {
  if (window.__ALBUM_BUNDLE_FIT__) return;
  window.__ALBUM_BUNDLE_FIT__ = true;

  // ---- 設定 ----
  const PHASE_MIN = 1, PHASE_MAX = 5;
  const MAX_PER_PHASE = 12;

  const url = new URL(location.href);
  const THUMB = Math.max(48, Math.min(200, parseInt(url.searchParams.get('thumb') || '90', 10) || 90));

  // ---- storage helpers ----
  const A = Array.isArray;
  const key = (p)=>`albumPhase_${p|0}`;
  const clamp = (p)=>Math.min(PHASE_MAX, Math.max(PHASE_MIN, p|0));
  const rd = (k,d=[])=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); return A(v)?v:d; }catch{ return d; } };
  const wr = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
  const dedupCap = (xs)=>{ const s=new Set(),o=[]; for(const x of xs){ const t=String(x||'').trim(); if(!t) continue; if(!s.has(t)){ s.add(t); o.push(t); if(o.length>=MAX_PER_PHASE) break; } } return o; };

  // ---- DOM helpers ----
  const $ = (sel,root=document)=>root.querySelector(sel);
  const el= (t,cls)=>{ const n=document.createElement(t); if(cls) n.className=cls; return n; };

  // ==========================================================
  // 0) 強制 CSS 注入（正方形フィットを担保）
  // ==========================================================
  (function ensureFitCSS(){
    const ID = 'album-strip-fit-css';
    if (document.getElementById(ID)) return;
    const s = document.createElement('style');
    s.id = ID;
    s.textContent = `
      .album-strip.auto-generated { --thumb:${THUMB}px; }
      .album-strip.auto-generated { overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity; }
      .album-strip.auto-generated .album-phase__rail { display:flex; flex-wrap:nowrap; gap:10px; align-items:center; min-height:var(--thumb); }
      .album-strip.auto-generated .album-thumb {
        width:var(--thumb) !important; height:var(--thumb) !important;
        flex:0 0 var(--thumb) !important;
        border-radius:12px; overflow:hidden;
        background:rgba(255,255,255,.08); box-shadow:0 1px 4px rgba(0,0,0,.35);
        scroll-snap-align:start;
      }
      .album-strip.auto-generated .album-thumb img {
        display:block !important;
        width:100% !important; height:100% !important;
        object-fit:cover !important; object-position:center center !important;
        aspect-ratio:1 / 1;
      }
      .album-strip.auto-generated .album-phase__title {
        display:inline-block; margin:10px 0 8px; padding:6px 14px;
        border-radius:16px; background:rgba(0,0,0,.62); color:#fff;
        backdrop-filter:blur(4px); font-weight:800; letter-spacing:.5px;
        font-size:15px; text-shadow:0 1px 3px rgba(0,0,0,.85);
      }
    `;
    document.head.appendChild(s);
  })();

  // ==========================================================
  // 1) 不要アルバム帯の確実な除去（albumGrid を直指定）
  // ==========================================================
  function killAlbumGrid() {
    const album = $('#album');
    if (!album) return;
    album.querySelectorAll('.albumGrid').forEach(n => n.remove());
    album.querySelectorAll('.album-row, .album-scroll, .album-mobile-scroll, .album-v1, .album-v2')
      .forEach(n => {
        if (!n.closest('.album-strip.auto-generated') && !n.closest('.album-phase')) n.remove();
      });
  }
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        if (n.matches?.('.albumGrid')) { n.remove(); continue; }
        const bads = n.querySelectorAll?.('.albumGrid');
        if (bads && bads.length) bads.forEach(x => x.remove());
      }
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const album = $('#album') || document.body;
    if (album) mo.observe(album, { childList:true, subtree:true });
    killAlbumGrid();
  });

  // ==========================================================
  // 2) 下段ストリップ（横スクロール・1列）
  // ==========================================================
  function attachWheelToHorizontal(scroller){
    scroller.addEventListener('wheel', (e)=>{
      const canScrollX = scroller.scrollWidth > scroller.clientWidth + 4;
      if (!canScrollX) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        scroller.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, {passive:false});
  }

  function ensureStrip(){
    const root = $('#album') || document.body;
    let strip = root.querySelector('.album-strip.auto-generated');
    if (strip) return strip;
    strip = el('div','album-strip auto-generated');
    strip.style.padding = '8px 0';
    strip.style.marginTop = '18px';
    attachWheelToHorizontal(strip);
    root.appendChild(strip);
    return strip;
  }

  function ensurePhase(strip, p){
    let sec = strip.querySelector(`.album-phase[data-phase="${p}"]`);
    if (sec) return sec;

    sec = el('section','album-phase'); sec.dataset.phase = String(p);
    const title = el('div','album-phase__title'); title.textContent = `Phase ${p}`;
    const rail  = el('div','album-phase__rail');

    sec.appendChild(title);
    sec.appendChild(rail);
    strip.appendChild(sec);
    return sec;
  }

  const lastSig = new Map();
  function paintPhase(p, urls, rail){
    const sig = JSON.stringify([THUMB, urls]);
    if (lastSig.get(p) === sig) return;
    lastSig.set(p, sig);

    rail.replaceChildren(); // 累積禁止

    for (const src of urls){
      const card = el('div','album-thumb');
      const img = new Image();
      img.loading='lazy'; img.decoding='async';
      img.src = src;

      // 念のための最終上書き（外部CSS対策）
      img.style.setProperty('width','100%','important');
      img.style.setProperty('height','100%','important');
      img.style.setProperty('object-fit','cover','important');
      img.style.setProperty('object-position','center center','important');
      img.style.setProperty('display','block','important');

      card.appendChild(img);
      rail.appendChild(card);
    }
  }

  function repaintAll(){
    killAlbumGrid(); // ← 先に掃除
    const strip = ensureStrip();
    for (let p=PHASE_MIN; p<=PHASE_MAX; p++){
      const sec  = ensurePhase(strip, p);
      const rail = sec.querySelector('.album-phase__rail');
      paintPhase(p, rd(key(p)), rail);
    }
  }

  // ==========================================================
  // 3) 保存 & イベント
  // ==========================================================
  function save(phase, src){
    const p = clamp(phase);
    const s = String(src||'').trim();
    if (!p || !s) return false;
    const cur = rd(key(p));
    if (cur.includes(s)) return false;
    wr(key(p), dedupCap([...cur, s]));
    return true;
  }

  const req = (()=>{ let a=0,b=0; return ()=>{ cancelAnimationFrame(a); cancelAnimationFrame(b); a=requestAnimationFrame(()=>{ b=requestAnimationFrame(repaintAll); }); }; })();

  function onPair(ev){ const d=ev && ev.detail || {}; if (save(d.phase, d.src)) req(); }
  ['prismcat:pair-match','prismcat:pair-match:v1','prismcat:pair-match:v2']
    .forEach(e => window.addEventListener(e, onPair, { passive:true }));

  ['storage','pageshow','resize','orientationchange']
    .forEach(e => window.addEventListener(e, req, { passive:true }));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', req, { passive:true });
  document.addEventListener('DOMContentLoaded', req, { once:true });

  // デバッグ用
  window.AlbumStore = {
    dump(){ const out={}; for(let p=PHASE_MIN;p<=PHASE_MAX;p++) out[key(p)] = rd(key(p)); return out; },
    clearAll(){ for(let p=PHASE_MIN;p<=PHASE_MAX;p++) localStorage.removeItem(key(p)); req(); }
  };
})();
