/* =========================================================================
 * album-fill.js — 8枠×Phase(1..5) / 90x90 / スライダー + シンプルLightbox(キャプションのみ)
 * 変更点:
 *  - クリック拡大は「画像 + キャプションのみ」：ズーム/虫眼鏡/右下ツールバー削除
 *  - キャプションは常時表示（画像クリックで表示/非表示をトグル可）
 *  - CAPTION_MAP があれば最優先で使用（なければ alt / data-cap を利用）
 * ========================================================================= */
(() => {
  'use strict';

  // ---- single renderer guard ----
  if (window.__AlbumRendererRegistered && window.__AlbumRendererRegistered !== 'album-fill') {
    console.debug('album-fill.js: skipped (renderer already =', window.__AlbumRendererRegistered, ')');
    return;
  }
  window.__AlbumRendererRegistered = 'album-fill';

  // ---- Config ----
  const PHASE_MIN = 1, PHASE_MAX = 5;
  const SLOTS = 8;
  const THUMB = 90;
  const GAME_SPEC_PATH = './GameSpec.json';

  // ---- CSS（スライダー + 余計なUI無しライトボックス + キャプション常時表示） ----
  (function injectCSS(){
    const id='album-fill-all-css';
    if (document.getElementById(id)) return;
    const s=document.createElement('style'); s.id=id;
    s.textContent = `
      #album .af-root{ display:grid; gap:14px; }
      #album .af-title{
        display:inline-block; padding:6px 12px; margin:6px 0 2px;
        border-radius:14px; background:rgba(0,0,0,.55); color:#fff;
        font-weight:800; letter-spacing:.3px; font-size:14px;
        text-shadow:0 1px 2px rgba(0,0,0,.8); backdrop-filter:blur(4px);
      }
      #album .af-slider{ position:relative; }
      #album .af-viewport{
        overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch;
        scroll-snap-type:x proximity; padding:2px 28px;
      }
      #album .af-rail{ display:flex; flex-wrap:nowrap; gap:10px; align-items:center; min-height:${THUMB}px; }
      #album .af-cell{
        width:${THUMB}px; height:${THUMB}px; flex:0 0 ${THUMB}px;
        border-radius:12px; overflow:hidden;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.05); position:relative;
        scroll-snap-align:start; content-visibility:auto;
        contain-intrinsic-size:${THUMB}px ${THUMB}px; cursor:pointer; /* ←虫眼鏡ではない */
      }
      #album .af-img{
        display:block !important; width:100% !important; height:100% !important;
        object-fit:cover !important; object-position:center center !important;
        user-select:none; pointer-events:none;
      }
      #album .af-skel{
        position:absolute; inset:0; border-radius:inherit;
        background:linear-gradient(120deg,rgba(255,255,255,.10),rgba(255,255,255,.22),rgba(255,255,255,.10));
        animation:af-shimmer 1.1s linear infinite;
      }
      @keyframes af-shimmer { 0%{transform:translateX(-30%)} 100%{transform:translateX(30%)} }
      #album .af-fail::after{
        content:"×"; position:absolute; right:6px; bottom:6px;
        color:#fff; background:#c33; padding:2px 6px; border-radius:10px;
        font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;
      }
      #album .af-nav{
        position:absolute; top:50%; transform:translateY(-50%);
        width:26px; height:52px; border-radius:12px;
        background:rgba(0,0,0,.45); color:#fff; border:none;
        display:grid; place-items:center; cursor:pointer;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      }
      #album .af-nav[disabled]{ opacity:.25; pointer-events:none; }
      #album .af-prev{ left:0; }  #album .af-next{ right:0; }
      #album .af-nav svg{ width:14px; height:14px; }
      #album .af-viewport::-webkit-scrollbar{ height:8px }
      #album .af-viewport::-webkit-scrollbar-thumb{ background:rgba(255,255,255,.25); border-radius:999px; }

      /* ===== Lightbox: 余計なUI無し（矢印ボタンも無し、ESC/背景クリックで閉じる、キャプション常時表示） ===== */
      .af-lightbox{
        position:fixed; inset:0; z-index:9999; display:none; place-items:center;
        background:rgba(0,0,0,.82); backdrop-filter:blur(2px); padding:2vh;
      }
      .af-lightbox.show{ display:grid; }
      .af-lb-stage{ position:relative; max-width:min(95vw, 1200px); max-height:min(90vh, 900px); }
      .af-lb-img{
        max-width:100%; max-height:100%; display:block; border-radius:8px;
        object-fit:contain; box-shadow:0 8px 28px rgba(0,0,0,.6);
        cursor:default; user-select:none; pointer-events:auto;
      }
      .af-lb-close{
        position:absolute; right:10px; top:10px;
        background:rgba(0,0,0,.5); color:#fff; border:none; border-radius:999px;
        width:36px; height:36px; display:grid; place-items:center; cursor:pointer;
      }

      /* Caption 常時表示（PC=14px / SP=12px） */
      .af-lb-caption{
        position:fixed; left:50%; bottom:2vh; transform:translateX(-50%);
        max-width:min(92vw, 1100px);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        background:rgba(0,0,0,.7); color:#fff;
        font-size:14px; line-height:1.6;
        padding:10px 14px; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,.25);
        text-align:center;
      }
      .af-cap-pill{
        display:inline-block; margin-right:.5em; padding:.05em .6em;
        font-weight:700; font-size:.9em; letter-spacing:.02em;
        color:#fff; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.18);
        border-radius:999px;
      }
      .af-cap-sub{ opacity:.85; margin-right:.4em; }
      .af-cap-sep{ opacity:.6; margin:0 .5em; }
      @media (max-width: 900px){
        .af-lb-caption{ font-size:12px; }
        .af-cap-sub{ display:none; }
      }
    `;
    document.head.appendChild(s);
  })();

  // ---- Helpers ----
  const onReady = (fn)=>
    (document.readyState === 'loading')
      ? document.addEventListener('DOMContentLoaded', fn, {once:true})
      : fn();

  const jsonRead = (k,d=[])=>{ try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(v)?v:d; }catch{ return d; } };
  const normalizeItems = (raw)=>
    (Array.isArray(raw)?raw:[])
      .map(v => typeof v==='string' ? v : (v && (v.src||v.url)) || '')
      .filter(Boolean).slice(0, SLOTS);

  let lastHash = '';
  const calcHash = (o)=>{ try{ return JSON.stringify(o); } catch { return String(Math.random()); } };
  const isMobile = () => matchMedia("(max-width: 900px)").matches;
  const jaVisualLen=(s='')=>{ let w=0; for(const ch of s) w += /[ -~｡-ﾟ]/.test(ch)?0.5:1; return w; };
  const ellipsisFit=(s='',max=48)=>{ if(jaVisualLen(s)<=max) return s; let b=''; for(const ch of s){ if(jaVisualLen(b+ch+'…')>max) break; b+=ch; } return b+'…'; };
  const safe = (s)=>String(s||'').replace(/[<>]/g,'');

  // Phase/Index 推定（data-* 優先、次に src から phaseXcardY を抽出）
  function derivePhaseIndex(img){
    const ds = img?.dataset||{};
    let phase = Number(ds.phase||0)||0;
    let index = Number(ds.card||ds.index||0)||0;
    const m = String(img.currentSrc||img.src||'').match(/phase(\d+)card(\d+)\.(webp|png|jpe?g|gif|avif)/i);
    if(m){ if(!phase) phase=Number(m[1])||0; if(!index) index=Number(m[2])||0; }
    return {phase,index};
  }

  // caption 構築（CAPTION_MAP ＞ data/alt）
  function buildCaption(img){
    const {phase,index} = derivePhaseIndex(img);
    const albumEl = document.querySelector('#album');

    // 外部 CAPTION_MAP（album-caption.js）を最優先で使う
    const CAP = (window.CAPTION_MAP || {});
    const bodyFromCap = (CAP[phase] && CAP[phase][index]) || '';

    // サブタイトルは data-sub{n} or data-sub or 既定文
    const defaultSubs = {1:'無音からはじまる',2:'境界に触れる',3:'記録する手',4:'揺らぎの部屋',5:'光の余韻'};
    const subtitle = img.dataset.sub || (albumEl?.dataset?.[`sub${phase}`]) || defaultSubs[phase] || '';

    const fallback = img.alt || img.dataset.cap || '';
    const bodyRaw  = bodyFromCap || fallback || '';
    const pill = phase ? `<span class="af-cap-pill">Phase ${phase}</span>` : '';
    const sub  = (!isMobile() && subtitle) ? `<span class="af-cap-sub">${safe(subtitle)}</span>` : '';
    const sep  = (sub && bodyRaw) ? `<span class="af-cap-sep">—</span>` : '';

    const max = isMobile() ? 38 : 52;
    const body = isMobile() ? safe(bodyRaw) : ellipsisFit(safe(bodyRaw), max - jaVisualLen(sub.replace(/<[^>]+>/g,'')) - 6);

    return `${pill}${sub}${sep}${body}`;
  }

  async function fetchPhases(){
    try{
      const r = await fetch(GAME_SPEC_PATH, {cache:'no-store'});
      if (!r.ok) throw 0;
      const spec=await r.json();
      if (spec && Array.isArray(spec.phases)) return spec.phases;
    }catch{}
    const arr=[]; for(let p=PHASE_MIN;p<=PHASE_MAX;p++) arr.push({id:p,title:`Phase ${p}`});
    return arr;
  }

  // ---- Slider wiring ----
  function attachSlider(sliderEl){
    const viewport = sliderEl.querySelector('.af-viewport');
    const prevBtn  = sliderEl.querySelector('.af-prev');
    const nextBtn  = sliderEl.querySelector('.af-next');

    // wheel: 縦→横
    viewport.addEventListener('wheel',(e)=>{
      if (viewport.scrollWidth <= viewport.clientWidth+4) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        viewport.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, {passive:false});

    // drag / swipe
    let dragging=false, startX=0, startLeft=0;
    const dragStart=(x)=>{ dragging=true; startX=x; startLeft=viewport.scrollLeft; };
    const dragMove=(x)=>{ if(!dragging) return; viewport.scrollLeft = startLeft - (x - startX); };
    const dragEnd =()=>{ dragging=false; };

    viewport.addEventListener('mousedown',e=>{ dragStart(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove',e=>dragMove(e.clientX));
    window.addEventListener('mouseup',dragEnd);

    viewport.addEventListener('touchstart',e=>{ const t=e.touches[0]; dragStart(t.clientX); },{passive:true});
    window.addEventListener('touchmove',e=>{ const t=e.touches[0]; dragMove(t.clientX); },{passive:true});
    window.addEventListener('touchend',dragEnd);

    // nav buttons
    function scrollByOne(direction){
      const item = viewport.querySelector('.af-cell');
      const w = item ? item.getBoundingClientRect().width + 10 : (THUMB+10);
      viewport.scrollBy({left: direction*w*3, behavior:'smooth'}); // 3枚ずつ
    }
    prevBtn.addEventListener('click',()=>scrollByOne(-1));
    nextBtn.addEventListener('click',()=>scrollByOne(1));

    // ボタン enable/disable
    const updateNav=()=>{
      const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth - 2);
      const x   = viewport.scrollLeft;
      prevBtn.disabled = x <= 2;
      nextBtn.disabled = x >= max;
    };
    viewport.addEventListener('scroll', updateNav, {passive:true});
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(updateNav); ro.observe(viewport);
    } else {
      window.addEventListener('resize', updateNav, {passive:true});
    }
    requestAnimationFrame(updateNav);
  }

  // ---- Lightbox（シンプル：画像＋キャプションのみ） ----
  function createLightbox(){
    let lb = document.querySelector('.af-lightbox');
    if (lb) return lb;
    lb = document.createElement('div');
    lb.className = 'af-lightbox';
    lb.innerHTML = `
      <div class="af-lb-stage">
        <img class="af-lb-img" alt="">
        <button class="af-lb-close" aria-label="close">✕</button>
      </div>
      <div class="af-lb-caption" aria-live="polite"></div>
    `;
    document.body.appendChild(lb);
    return lb;
  }
  const Lightbox = (() => {
    const lb = createLightbox();
    const img = lb.querySelector('.af-lb-img');
    const cap = lb.querySelector('.af-lb-caption');
    const closeBtn = lb.querySelector('.af-lb-close');

    function open(imgEl){
      img.src = imgEl.currentSrc || imgEl.src;
      cap.innerHTML = buildCaption(imgEl);
      lb.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function close(){
      lb.classList.remove('show');
      document.body.style.overflow = '';
    }

    // 閉じる操作：ESC / 背景クリック / ×ボタン
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && lb.classList.contains('show')) close(); });
    lb.addEventListener('click', (e)=>{ if(e.target===lb) close(); });
    closeBtn.addEventListener('click', close);

    // 画像クリックでキャプショントグル（任意）
    img.addEventListener('click', (e)=>{
      e.stopPropagation();
      cap.style.display = (cap.style.display === 'none') ? 'block' : 'none';
    });

    return { open, close };
  })();

  // ---- Render ----
  async function fillAlbum(){
    try{
      const album = document.querySelector('#album');
      if (!album) return;

      const phases = await fetchPhases();
      const snapshot = phases
        .filter(ph => ph && ph.id>=PHASE_MIN && ph.id<=PHASE_MAX)
        .map(ph => ({
          id: ph.id,
          title: ph.title || `Phase ${ph.id}`,
          items: normalizeItems(jsonRead(`albumPhase_${ph.id}`))
        }));

      const nextHash = calcHash(snapshot);
      if (nextHash === lastHash) return;
      lastHash = nextHash;

      album.innerHTML = '';
      const root = document.createElement('div');
      root.className = 'af-root';
      album.appendChild(root);

      for (const ph of snapshot){
        // Title
        const title = document.createElement('div');
        title.className = 'af-title';
        title.textContent = `Phase ${ph.id}：${ph.title}`;
        root.appendChild(title);

        // Slider shell
        const slider = document.createElement('div');
        slider.className = 'af-slider';
        slider.innerHTML = `
          <button class="af-nav af-prev" aria-label="prev" title="Prev">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 19 8.5 12l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="af-viewport">
            <div class="af-rail"></div>
          </div>
          <button class="af-nav af-next" aria-label="next" title="Next">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5 15.5 12l-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        `;
        root.appendChild(slider);

        const rail = slider.querySelector('.af-rail');

        // 8枠生成（足りない分は空枠）
        for (let i=0; i<SLOTS; i++){
          const cell = document.createElement('div');
          cell.className = 'af-cell';
          rail.appendChild(cell);

          const src = ph.items[i];
          if (!src) continue;

          const skel = document.createElement('div');
          skel.className = 'af-skel';
          cell.appendChild(skel);

          // decode待ち→挿入
          const probe = new Image();
          probe.src = src;
          (probe.decode ? probe.decode() : Promise.resolve())
            .catch(()=>{}) // 失敗は×表示に回す
            .finally(()=>{
              const img = new Image();
              img.className = 'af-img';
              img.alt = `Phase ${ph.id} ${i+1}`;
              img.src = src;
              img.addEventListener('load', ()=> skel.remove(), {once:true});
              img.addEventListener('error', ()=>{ cell.classList.add('af-fail'); skel.remove(); }, {once:true});
              cell.appendChild(img);
            });

          // クリックでシンプルLightbox（画像＋キャプションのみ）
          cell.addEventListener('click', ()=>{
            const imgEl = cell.querySelector('.af-img');
            if (imgEl) Lightbox.open(imgEl);
          });
        }

        // スライダーを有効化
        attachSlider(slider);
      }
    }catch(err){
      console.error('album-fill render error:', err);
    }
  }

  // ---- Triggers ----
  onReady(fillAlbum);
  window.addEventListener('pageshow', fillAlbum);
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible') fillAlbum(); });
  window.addEventListener('storage', (e)=>{ if (e.key && e.key.startsWith('albumPhase_')) fillAlbum(); });
  window.addEventListener('album:updated', fillAlbum);
  window.addEventListener('prismcat:pair-match', fillAlbum);
  window.addEventListener('prismcat:pair-match:v1', fillAlbum);
  window.addEventListener('prismcat:pair-match:v2', fillAlbum);
})();
