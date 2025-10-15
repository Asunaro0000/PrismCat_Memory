/* =========================================================================
 * bundle.albumStore.js — StableRenderer v3 (deterministic, wait-first)
 * Phase=1..5 / 90x90 / 横スクロール / 「待ってでも確実に」描画
 *  - 各フェーズを順次処理し、全画像が decode() 成功 or タイムアウトまで待機してから一括コミット
 *  - ?thumb=90  … サムネ(px)
 *  - ?per=1200  … 1枚あたり待機上限ms（リトライ1回込み）
 *  - ?cap=4000  … フェーズ全体の待機上限ms（ミリ秒）
 * ========================================================================= */
(() => {
  if (window.__ALBUM_STABLE_V3__) return;
  window.__ALBUM_STABLE_V3__ = '2025-10-15-v3';

  // ---------- Config ----------
  const PHASE_MIN = 1, PHASE_MAX = 5;
  const MAX_PER_PHASE = 12;

  const url   = new URL(location.href);
  const THUMB = Math.max(48, Math.min(200, parseInt(url.searchParams.get('thumb')||'90', 10) || 90));
  const WAIT_PER_IMG = Math.max(300, parseInt(url.searchParams.get('per')||'1200', 10) || 1200); // ms / image
  const WAIT_CAP_PHS  = Math.max(800, parseInt(url.searchParams.get('cap')||'4000', 10) || 4000); // ms / phase
  const RETRY_MAX = 1; // decodeエラー時の軽リトライ

  // ---------- Storage ----------
  const A  = Array.isArray;
  const K  = (p)=>`albumPhase_${p|0}`;
  const rd = (k,d=[])=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); return A(v)?v:d; }catch{ return d; } };
  const wr = (k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
  const dedupCap = (xs)=>{ const s=new Set(),o=[]; for(const x of xs){ const t=String(x||'').trim(); if(!t) continue; if(!s.has(t)){ s.add(t); o.push(t); if(o.length>=MAX_PER_PHASE) break; } } return o; };
  const clamp=(p)=>Math.min(PHASE_MAX,Math.max(PHASE_MIN,p|0));

  // ---------- CSS（正方形固定＋スケルトン） ----------
  (function css(){
    const id='album-stable-v3-css';
    if (document.getElementById(id)) return;
    const s=document.createElement('style'); s.id=id;
    s.textContent = `
      .album-strip.auto-generated{--thumb:${THUMB}px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding:8px 0;margin-top:18px;border-radius:12px}
      .album-phase__title{display:inline-block;margin:10px 0 8px;padding:6px 14px;border-radius:16px;background:rgba(0,0,0,.62);color:#fff;backdrop-filter:blur(4px);font-weight:800;letter-spacing:.5px;font-size:15px;text-shadow:0 1px 3px rgba(0,0,0,.85)}
      .album-phase__rail{display:flex;flex-wrap:nowrap;gap:10px;align-items:center;min-height:var(--thumb)}
      .album-thumb{width:var(--thumb)!important;height:var(--thumb)!important;flex:0 0 var(--thumb)!important;border-radius:12px;overflow:hidden;scroll-snap-align:start;background:rgba(255,255,255,.08);box-shadow:0 1px 4px rgba(0,0,0,.32);position:relative}
      .album-thumb img{display:block!important;width:100%!important;height:100%!important;object-fit:cover!important;object-position:center center!important;user-select:none;pointer-events:none}
      .thumb-skel{position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.12),rgba(255,255,255,.22),rgba(255,255,255,.12));animation:sh 1.1s infinite;filter:saturate(.7);border-radius:inherit}
      @keyframes sh{0%{transform:translateX(-30%)}100%{transform:translateX(30%)}}
      .thumb-fail::after{content:"×";position:absolute;right:6px;bottom:6px;color:#fff;background:#c33;padding:2px 6px;border-radius:10px;font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif}
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
    for(const m of muts){ for(const n of m.addedNodes){
      if(!(n instanceof HTMLElement)) continue;
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

  // ---------- 画像読み込み（decode + timeout + retry） ----------
  function loadWithDecode(src, timeoutMs){
    return new Promise((resolve)=>{
      const img = new Image();
      let done = false;
      const finish = (ok)=>{ if(done) return; done=true; resolve(!!ok); };
      img.addEventListener('load',  ()=>finish(true),  {once:true});
      img.addEventListener('error', ()=>finish(false), {once:true});
      img.src = src;
      if (img.decode) {
        img.decode().then(()=>finish(true)).catch(()=>finish(false));
      }
      setTimeout(()=>finish(false), timeoutMs);
    });
  }

  async function waitImage(src){
    // 1回目
    if (await loadWithDecode(src, WAIT_PER_IMG)) return true;
    // リトライ（キャッシュが効くことが多い）
    if (RETRY_MAX > 0) {
      return await loadWithDecode(src, Math.floor(WAIT_PER_IMG * 0.75));
    }
    return false;
  }

  // ---------- レンダキュー（逐次・コミット制） ----------
  let ENQ = false, RUN = false, GEN = 0; // デバウンス、ロック、世代

  function enqueue(){
    if (ENQ) return;
    ENQ = true;
    requestAnimationFrame(()=>{ requestAnimationFrame(runOnce); });
  }

  async function runOnce(){
    if (RUN) return;
    ENQ = false;
    RUN = true;
    const gen = ++GEN;

    killAlbumGrid();
    const strip = ensureStrip();

    // フェーズを 1→5 の順に「待ってからコミット」
    for (let p=PHASE_MIN; p<=PHASE_MAX; p++){
      if (gen !== GEN) break; // 新しい世代が来たら中断

      const urls = rd(K(p));
      const sec  = ensurePhase(strip, p);
      const rail = sec.querySelector('.album-phase__rail');

      // 事前にプレースホルダー（箱）を用意：レイアウトを先に安定させる
      const frag = document.createDocumentFragment();
      const slots = [];
      for (let i=0; i<urls.length; i++){
        const card = el('div','album-thumb');
        card.appendChild(el('div','thumb-skel'));
        // 中に img を差し込むのはコミット直前（decode 完了後）
        slots.push(card);
        frag.appendChild(card);
      }

      // 画像を順に decode（並列でも良いが、確実性優先で逐次）
      const start = performance.now();
      const results = [];
      for (let i=0; i<urls.length; i++){
        // phase 全体の上限時間に達したら残りは即失敗扱いで抜ける
        if (performance.now() - start > WAIT_CAP_PHS) { results.push(false); continue; }
        // 個別待機
        const ok = await waitImage(urls[i]);
        results.push(ok);
      }

      // コミット：箱を差し替え（このタイミングで <img> を入れる）
      // 古い中間描画はしない＝決定論
      const commit = document.createDocumentFragment();
      for (let i=0; i<urls.length; i++){
        const card = slots[i];
        const img  = new Image();
        img.loading='lazy'; img.decoding='async'; img.alt='';
        // 最終保険（外部CSSを殺す）
        img.style.setProperty('width','100%','important');
        img.style.setProperty('height','100%','important');
        img.style.setProperty('object-fit','cover','important');
        img.style.setProperty('object-position','center center','important');

        img.src = urls[i];
        img.addEventListener('load', ()=>{ card.querySelector('.thumb-skel')?.remove(); }, {once:true});
        if (!results[i]) card.classList.add('thumb-fail'); // 失敗表示（×）

        card.appendChild(img);
        commit.appendChild(card);
      }

      // 置換コミット（これでフェーズごとに一度だけDOMが動く）
      rail.replaceChildren(commit);

      // 次フェーズに進む前に、idle で少し譲る（描画完了を待たせる）
      await new Promise(r => ('requestIdleCallback' in window) ? requestIdleCallback(()=>r(), {timeout:120}) : setTimeout(r, 16));
    }

    RUN = false;
  }

  // ---------- 保存 & イベント ----------
  function save(phase, src){
    const p=clamp(phase), s=String(src||'').trim(); if(!p||!s) return false;
    const cur=rd(K(p)); if(cur.includes(s)) return false;
    wr(K(p), dedupCap([...cur, s])); return true;
  }

  ['prismcat:pair-match','prismcat:pair-match:v1','prismcat:pair-match:v2']
    .forEach(e=>window.addEventListener(e,(ev)=>{ const d=ev?.detail||{}; if(save(d.phase,d.src)) enqueue(); },{passive:true}));

  ['storage','pageshow','resize','orientationchange','visibilitychange']
    .forEach(e=>window.addEventListener(e, enqueue, {passive:true}));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', enqueue, {passive:true});
  document.addEventListener('DOMContentLoaded', enqueue, {once:true});

  // ---------- 手元ユーティリティ ----------
  window.AlbumStore = {
    dump(){ const out={}; for(let p=PHASE_MIN;p<=PHASE_MAX;p++) out[K(p)] = rd(K(p)); return out; },
    clearAll(){ for(let p=PHASE_MIN;p<=PHASE_MAX;p++) localStorage.removeItem(K(p)); enqueue(); }
  };
})();
