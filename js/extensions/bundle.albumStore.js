/* =========================================================================
 * bundle.albumStore.js — StableRenderer v1
 * Phase=1..5 / 90x90 横スクロール / 決定論描画（トークン・差分・スロット固定・ロード管理）
 * ========================================================================= */
(() => {
  if (window.__ALBUM_STABLE_RENDERER__) return;
  window.__ALBUM_STABLE_RENDERER__ = true;

  // ---------- Config ----------
  const PHASE_MIN = 1, PHASE_MAX = 5;
  const MAX_PER_PHASE = 12;
  const url = new URL(location.href);
  const THUMB = Math.max(48, Math.min(200, parseInt(url.searchParams.get('thumb') || '90', 10) || 90));
  const RETRY_MAX = 2;

  // ---------- Storage ----------
  const A  = Array.isArray;
  const K  = (p)=>`albumPhase_${p|0}`;
  const rd = (k,d=[])=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); return A(v)?v:d; }catch{ return d; } };
  const wr = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
  const dedupCap = (xs)=>{ const s=new Set(),o=[]; for(const x of xs){ const t=String(x||'').trim(); if(!t) continue; if(!s.has(t)){ s.add(t); o.push(t); if(o.length>=MAX_PER_PHASE) break; } } return o; };
  const clamp=(p)=>Math.min(PHASE_MAX,Math.max(PHASE_MIN,p|0));

  // ---------- CSS (fit + skeleton) ----------
  (function injectCSS(){
    const id='album-stable-css';
    if (document.getElementById(id)) return;
    const s=document.createElement('style'); s.id=id;
    s.textContent = `
      .album-strip.auto-generated{--thumb:${THUMB}px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding:8px 0;margin-top:18px;border-radius:12px}
      .album-phase__title{display:inline-block;margin:10px 0 8px;padding:6px 14px;border-radius:16px;background:rgba(0,0,0,.62);color:#fff;backdrop-filter:blur(4px);font-weight:800;letter-spacing:.5px;font-size:15px;text-shadow:0 1px 3px rgba(0,0,0,.85)}
      .album-phase__rail{display:flex;flex-wrap:nowrap;gap:10px;align-items:center;min-height:var(--thumb)}
      .album-thumb{width:var(--thumb)!important;height:var(--thumb)!important;flex:0 0 var(--thumb)!important;border-radius:12px;overflow:hidden;scroll-snap-align:start;background:rgba(255,255,255,.08);box-shadow:0 1px 4px rgba(0,0,0,.32);position:relative;content-visibility:auto;contain-intrinsic-size:var(--thumb) var(--thumb)}
      .album-thumb img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center center!important;user-select:none;pointer-events:none}
      .thumb-skel{position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.12),rgba(255,255,255,.22),rgba(255,255,255,.12));animation:sh 1.2s infinite;filter:saturate(.7);border-radius:inherit}
      @keyframes sh{0%{transform:translateX(-30%)}100%{transform:translateX(30%)}}
      .thumb-fail::after{content:"×";position:absolute;inset:auto auto 6px 8px;color:#fff;background:#c33;padding:2px 6px;border-radius:10px;font:600 12px/1 system-ui, -apple-system, Segoe UI, sans-serif}
    `;
    document.head.appendChild(s);
  })();

  // ---------- Kill legacy albumGrid ----------
  const $ = (sel,root=document)=>root.querySelector(sel);
  function killAlbumGrid(){
    const album=$('#album'); if(!album) return;
    album.querySelectorAll('.albumGrid,.album-row,.album-scroll,.album-mobile-scroll,.album-v1,.album-v2')
      .forEach(n=>{ if(!n.closest('.album-strip.auto-generated') && !n.closest('.album-phase')) n.remove(); });
  }
  const mo=new MutationObserver(muts=>{
    for(const m of muts){ for(const n of m.addedNodes){ if(!(n instanceof HTMLElement)) continue;
      if(n.matches?.('.albumGrid')){ n.remove(); continue; }
      n.querySelectorAll?.('.albumGrid').forEach(x=>x.remove());
    } }
  });
  document.addEventListener('DOMContentLoaded',()=>{ const album=$('#album')||document.body; if(album) mo.observe(album,{childList:true,subtree:true}); killAlbumGrid(); });

  // ---------- Strip / Phase ----------
  const el=(t,c)=>{ const n=document.createElement(t); if(c) n.className=c; return n; };
  function attachWheelToHorizontal(scroller){
    scroller.addEventListener('wheel', (e)=>{
      if(scroller.scrollWidth <= scroller.clientWidth+4) return;
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){ scroller.scrollLeft += e.deltaY; e.preventDefault(); }
    }, {passive:false});
  }
  function ensureStrip(){
    const root=$('#album')||document.body;
    let strip=root.querySelector('.album-strip.auto-generated'); if(strip) return strip;
    strip=el('div','album-strip auto-generated'); attachWheelToHorizontal(strip); root.appendChild(strip); return strip;
  }
  function ensurePhase(strip,p){
    let sec=strip.querySelector(`.album-phase[data-phase="${p}"]`); if(sec) return sec;
    sec=el('section','album-phase'); sec.dataset.phase=String(p);
    const title=el('div','album-phase__title'); title.textContent=`Phase ${p}`;
    const rail =el('div','album-phase__rail');
    sec.appendChild(title); sec.appendChild(rail); strip.appendChild(sec); return sec;
  }

  // ---------- Stable image loader with Abort + retry ----------
  const loaders = new WeakMap(); // img -> {abort, tries}
  function loadInto(img, src, token){
    // cancel previous
    const prev=loaders.get(img);
    if(prev){ prev.abort.abort(); loaders.delete(img); }

    const ctl = new AbortController();
    loaders.set(img,{abort:ctl, tries:(prev?.tries||0)});

    const doSet = ()=>{ if(img.__token!==token) return; img.src=src; };

    // preload using Image + decode; fallback to direct set on error
    const tmp = new Image();
    tmp.decoding='async'; tmp.loading='eager';
    tmp.addEventListener('load', ()=>{
      if(ctl.signal.aborted) return;
      doSet();
    }, {once:true});
    tmp.addEventListener('error', ()=>{
      if(ctl.signal.aborted) return;
      // retry a couple of times (cache/momentary errors)
      const rec = loaders.get(img); if(!rec || rec.abort.signal.aborted) return;
      if(rec.tries < RETRY_MAX){ rec.tries++; setTimeout(()=> loadInto(img, src, token), 120*(rec.tries)); }
      else { img.closest('.album-thumb')?.classList.add('thumb-fail'); doSet(); }
    }, {once:true});
    tmp.src = src;
    // try decode but ignore errors
    tmp.decode?.().catch(()=>{});
  }

  // ---------- Renderer (deterministic) ----------
  let paintToken = 0;                  // 世代トークン
  const lastSig = new Map();           // p -> hash
  function paintPhase(p, urls, rail, token){
    // signature to avoid unnecessary work
    const sig = JSON.stringify([THUMB, urls]);
    if (lastSig.get(p) === sig) return;
    lastSig.set(p, sig);

    // diff: reuse slots if possible
    const children = Array.from(rail.children);
    const need = urls.length;
    // trim
    while(children.length > need){ rail.removeChild(children.pop()); }
    // create missing slots
    while(children.length < need){
      const card = el('div','album-thumb'); card.draggable=false;
      const skel = el('div','thumb-skel'); card.appendChild(skel);
      const img  = new Image(); img.decoding='async'; img.loading='lazy'; img.alt='';
      card.appendChild(img);
      rail.appendChild(card);
      children.push(card);
    }
    // assign sources
    children.forEach((card,i)=>{
      const img = card.querySelector('img');
      card.classList.remove('thumb-fail');
      img.__token = token; // tie to generation
      // keep skeleton until decoded
      img.addEventListener('load', ()=>{ card.querySelector('.thumb-skel')?.remove(); }, {once:true});
      loadInto(img, urls[i], token);
    });
  }

  function repaintAll(){
    killAlbumGrid();                                  // まず掃除
    const token = ++paintToken;                       // 新世代トークン
    const strip = ensureStrip();
    // 分割して idle で段階的に負荷分散（安定＆滑らか）
    let p = PHASE_MIN;
    const step = ()=>{
      if (p > PHASE_MAX) return;
      for (let c=0; c<2 && p<=PHASE_MAX; c++, p++){
        const sec  = ensurePhase(strip, p);
        const rail = sec.querySelector('.album-phase__rail');
        const urls = rd(K(p));
        paintPhase(p, urls, rail, token);
      }
      if ('requestIdleCallback' in window) requestIdleCallback(step, {timeout:120});
      else setTimeout(step, 16);
    };
    step();
  }

  // ---------- Events ----------
  function save(phase, src){
    const p=clamp(phase), s=String(src||'').trim(); if(!p||!s) return false;
    const cur=rd(K(p)); if(cur.includes(s)) return false;
    wr(K(p), dedupCap([...cur, s])); return true;
  }
  const req = (()=>{ let a=0,b=0; return ()=>{ cancelAnimationFrame(a); cancelAnimationFrame(b); a=requestAnimationFrame(()=>{ b=requestAnimationFrame(repaintAll); }); }; })();

  ['prismcat:pair-match','prismcat:pair-match:v1','prismcat:pair-match:v2']
    .forEach(e=>window.addEventListener(e,(ev)=>{ const d=ev&&ev.detail||{}; if(save(d.phase,d.src)) req(); },{passive:true}));
  ['storage','pageshow','resize','orientationchange','visibilitychange']
    .forEach(e=>window.addEventListener(e, req, {passive:true}));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', req, {passive:true});
  document.addEventListener('DOMContentLoaded', req, {once:true});

  // ---------- Debug helpers ----------
  window.AlbumStore = {
    dump(){ const out={}; for(let p=PHASE_MIN;p<=PHASE_MAX;p++) out[K(p)] = rd(K(p)); return out; },
    clearAll(){ for(let p=PHASE_MIN;p<=PHASE_MAX;p++) localStorage.removeItem(K(p)); req(); }
  };
})();
