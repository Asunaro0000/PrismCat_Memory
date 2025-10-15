/* =========================================================================
 * album-fill.js — 8枠×Phase(1..5) / 90x90 正方形フィット / 再入OK
 * - Renderer 単一ガード（IIFE内で安全。トップレベル return は使わない）
 * - localStorage: ["url"] / [{src:"url"}] どちらもOK
 * - GameSpec.json の phases を参照（無ければ 1..5 を自動補完）
 * - pageshow / visibilitychange / storage / album:updated で自動再描画
 * - 画像は decode 待ち+スケルトンでチラつき抑制
 * ========================================================================= */
(() => {
  'use strict';

  // ---------------- Renderer guard ----------------
  // すでに別レンダラーが登録済みならスキップ（トップレベル return は使わない）
  if (window.__AlbumRendererRegistered && window.__AlbumRendererRegistered !== 'album-fill') {
    console.debug('album-fill.js: skipped (renderer already registered =', window.__AlbumRendererRegistered, ')');
    return;
  }
  window.__AlbumRendererRegistered = 'album-fill';

  // ---------------- Config ----------------
  const PHASE_MIN = 1, PHASE_MAX = 5; // Phaseは最大5
  const SLOTS = 8;                    // 各Phase 8枠
  const THUMB = 90;                   // 90x90 正方形
  const GAME_SPEC_PATH = './GameSpec.json';

  // ---------------- CSS（強制フィット+見出し） ----------------
  (function injectCSS(){
    const id = 'album-fill-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      #album .af-root{ display:grid; gap:14px; }
      #album .af-title{
        display:inline-block; padding:6px 12px; margin:6px 0 2px;
        border-radius:14px; background:rgba(0,0,0,.55); color:#fff;
        font-weight:800; letter-spacing:.3px; font-size:14px;
        text-shadow:0 1px 2px rgba(0,0,0,.8); backdrop-filter:blur(4px);
      }
      #album .af-grid{
        display:grid; grid-template-columns:repeat(8, ${THUMB}px); gap:8px;
      }
      #album .af-cell{
        width:${THUMB}px; height:${THUMB}px; border-radius:12px; overflow:hidden;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.05); position:relative;
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
      #album .af-fail::after{
        content:"×"; position:absolute; right:6px; bottom:6px;
        color:#fff; background:#c33; padding:2px 6px; border-radius:10px;
        font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;
      }
      @keyframes af-shimmer { 0%{transform:translateX(-30%)} 100%{transform:translateX(30%)} }
    `;
    document.head.appendChild(s);
  })();

  // ---------------- Utils ----------------
  const onReady = (fn)=>
    (document.readyState === 'loading')
      ? document.addEventListener('DOMContentLoaded', fn, {once:true})
      : fn();

  const jsonRead = (k, d=[]) => { try { const v = JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(v)?v:d; } catch { return d; } };
  const normalizeItems = (raw) =>
    (Array.isArray(raw) ? raw : [])
      .map(v => typeof v === 'string' ? v : (v && (v.src || v.url)) || '')
      .filter(Boolean)
      .slice(0, SLOTS);

  // ハッシュで重複描画を抑止
  let lastHash = '';
  const calcHash = (obj) => { try { return JSON.stringify(obj); } catch { return String(Math.random()); } };

  // ---------------- Data fetch ----------------
  async function fetchSpec() {
    try {
      const r = await fetch(GAME_SPEC_PATH, { cache: 'no-store' });
      if (!r.ok) throw 0;
      const spec = await r.json();
      return spec && Array.isArray(spec.phases) ? spec.phases : null;
    } catch {
      return null;
    }
  }

  function fallbackPhases(){
    // GameSpec.json が無い/壊れてる場合でも 1..5 を表示
    const arr = [];
    for (let p = PHASE_MIN; p <= PHASE_MAX; p++){
      arr.push({ id: p, title: `Phase ${p}` });
    }
    return arr;
  }

  // ---------------- Render ----------------
  async function fillAlbum(){
    const album = document.querySelector('#album');
    if (!album) return;

    const phases = (await fetchSpec()) || fallbackPhases();

    const snapshot = phases
      .filter(ph => ph && ph.id >= PHASE_MIN && ph.id <= PHASE_MAX)
      .map(ph => ({
        id: ph.id,
        title: ph.title || `Phase ${ph.id}`,
        items: normalizeItems(jsonRead(`albumPhase_${ph.id}`))
      }));

    const nextHash = calcHash(snapshot);
    if (nextHash === lastHash) return;
    lastHash = nextHash;

    // クリアしてから再構築
    album.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'af-root';
    album.appendChild(root);

    // フェーズごとに箱→decode→差し替え
    for (const ph of snapshot) {
      // Title
      const title = document.createElement('div');
      title.className = 'af-title';
      title.textContent = `Phase ${ph.id}：${ph.title}`;
      root.appendChild(title);

      // Grid
      const grid = document.createElement('div');
      grid.className = 'af-grid';
      root.appendChild(grid);

      // 8枠生成（足りない分は空枠）
      for (let i=0; i<SLOTS; i++){
        const cell = document.createElement('div');
        cell.className = 'af-cell';
        grid.appendChild(cell);

        const src = ph.items[i];
        if (!src) continue;

        // スケルトン先置き → 画像decode後に反映
        const skel = document.createElement('div');
        skel.className = 'af-skel';
        cell.appendChild(skel);

        const img = new Image();
        img.className = 'af-img';
        img.alt = `Phase ${ph.id} ${i+1}`;

        // decode待ち（確実描画）
        const tmp = new Image();
        tmp.src = src;
        (tmp.decode ? tmp.decode() : Promise.resolve())
          .catch(()=>{})     // decode失敗は無視してそのまま表示
          .finally(()=>{
            img.src = src;
            img.addEventListener('load', ()=> skel.remove(), {once:true});
            img.addEventListener('error', ()=>{
              cell.classList.add('af-fail');
              skel.remove();
            }, {once:true});
            cell.appendChild(img);
          });
      }
    }
  }

  // ---------------- Triggers ----------------
  onReady(fillAlbum);
  // bfcache復帰 / タブ復帰 / ストレージ更新 / 手動通知
  window.addEventListener('pageshow', fillAlbum);
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'visible') fillAlbum(); });
  window.addEventListener('storage', (e)=>{ if (!e.key) return; if (e.key.startsWith('albumPhase_')) fillAlbum(); });
  window.addEventListener('album:updated', fillAlbum);
  // 一部の拡張からのマッチ通知を拾って再描画
  window.addEventListener('prismcat:pair-match', fillAlbum);
  window.addEventListener('prismcat:pair-match:v1', fillAlbum);
  window.addEventListener('prismcat:pair-match:v2', fillAlbum);

  // ---------------- Optional: bfcache/戻る進むのハードリロード ----------------
  (function(){
    function shouldReloadOnBack(){
      if (sessionStorage.getItem('needRefresh') === '1') return true;
      if ('onpageshow' in window && window.performance) {
        const nav = performance.getEntriesByType('navigation')[0];
        if (nav && nav.type === 'back_forward') return true;
      }
      return false;
    }
    window.addEventListener('pageshow', function(e){
      if (e.persisted || shouldReloadOnBack()){
        sessionStorage.removeItem('needRefresh');
        setTimeout(()=>location.reload(), 60);
      }
    });
  })();
})();
