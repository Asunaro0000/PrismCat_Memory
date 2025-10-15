/* bundle.albumStore.js — Router + Bridge + StoreV1 + StoreV2 + Tools + RendererGuard */
(() => {
  // ===== 0) Renderer 単一登録ヘルパ =====
  if (!window.registerAlbumRenderer) {
    window.registerAlbumRenderer = function(name){
      if (window.__AlbumRendererRegistered) return false;
      window.__AlbumRendererRegistered = name || 'renderer';
      return true;
    };
  }

  // ===== 1) Router: アクティブ系統の決定（v1 / v2 / off） =====
  if (!window.__extAlbumStoreRouter) {
    window.__extAlbumStoreRouter = true;
    const url = new URL(location.href);
    const q   = url.searchParams.get('store');        // v1|v2|off
    const ls  = localStorage.getItem('ALBUM_STORE_ACTIVE');
    const DEF = 'v2';
    const pick = (x) => (x==='v1'||x==='v2'||x==='off') ? x : null;
    const ACTIVE = pick(q) ?? pick(ls) ?? DEF;
    localStorage.setItem('ALBUM_STORE_ACTIVE', ACTIVE);
    window.ALBUM_STORE_ACTIVE   = ACTIVE;
    window.__AlbumStoreDisabled = (ACTIVE === 'off');
    // console.log('[AlbumStore Router] active =', ACTIVE);
  }

  // ===== 2) Bridge: 旧イベント → v1/v2 個別イベントに分配 =====
  if (!window.__extAlbumStoreBridge) {
    window.__extAlbumStoreBridge = true;
    window.addEventListener('prismcat:pair-match', (ev) => {
      const d = ev?.detail || {};
      const det = { phase: d.phase, src: d.src };
      // 旧から両系統に再送（受信側でアクティブか判定）
      window.dispatchEvent(new CustomEvent('prismcat:pair-match:v1', { detail: det }));
      window.dispatchEvent(new CustomEvent('prismcat:pair-match:v2', { detail: det }));
    }, { passive: true });
  }

  // ===== 共通: 小物 =====
  const _MAX = 12;
  const _read = (key) => { try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } };
  const _write = (key, arr) => { try { localStorage.setItem(key, JSON.stringify(arr)); } catch {} };
  const _toRel = (s) => {
    s = String(s||'');
    if (!s || s.startsWith('blob:') || s.startsWith('data:')) return '';
    try { const u = new URL(s, document.baseURI);
      const m = u.pathname.match(/\/assets\/.+/);
      return m ? '.' + m[0] : s;
    } catch {
      const i = s.indexOf('/assets/'); return i>=0 ? '.' + s.slice(i) : s;
    }
  };

  // ===== 3) Store V1（絶対URLなど既存互換） =====
  if (!window.__extAlbumStoreV1 && !window.__AlbumStoreDisabled && window.ALBUM_STORE_ACTIVE==='v1') {
    window.__extAlbumStoreV1 = true;
    const K = (p) => `albumPhase_v1_${p}`;
    function onMatch(ev){
      const d = ev?.detail || {};
      const phase = Number(d.phase||0);
      const src   = String(d.src||'');
      if (!phase || !src) return;
      const key = K(phase);
      const cur = _read(key);
      if (!cur.includes(src) && cur.length < _MAX){
        cur.push(src);
        _write(key, cur);
      }
    }
    window.addEventListener('prismcat:pair-match:v1', onMatch, { passive: true });
    // console.log('[AlbumStore V1] init');
  }

  // ===== 4) Store V2（相対URL正規化＋重複除去） =====
  if (!window.__extAlbumStoreV2 && !window.__AlbumStoreDisabled && window.ALBUM_STORE_ACTIVE==='v2') {
    window.__extAlbumStoreV2 = true;
    const K = (p) => `albumPhase_v2_${p}`;
    function onMatch(ev){
      const d = ev?.detail || {};
      const phase = Number(d.phase||0);
      const src   = _toRel(d.src);
      if (!phase || !src) return;
      const key = K(phase);
      const cur = _read(key);
      if (!cur.includes(src)) {
        const seen = new Set(); const out = [];
        for (const x of [...cur, src]) if (!seen.has(x) && seen.add(x)) out.push(x);
        _write(key, out.slice(0,_MAX));
      }
    }
    window.addEventListener('prismcat:pair-match:v2', onMatch, { passive: true });
    // console.log('[AlbumStore V2] init');
  }

  // ===== 5) Tools（移行・全消し・ダンプ・非常口） =====
  if (!window.__extAlbumStoreTools) {
    window.__extAlbumStoreTools = true;
    window.AlbumStoreTools = {
      migrateV1toV2(MAX=_MAX, PHASES=8){
        for (let p=1;p<=PHASES;p++){
          const v1=_read(`albumPhase_v1_${p}`), v2=_read(`albumPhase_v2_${p}`);
          const merged = Array.from(new Set([...v2, ...v1.map(_toRel)])).slice(0,MAX);
          _write(`albumPhase_v2_${p}`, merged);
          console.log('migrated phase', p, '->', merged.length);
        }
      },
      clearAll(PHASES=8){
        for (let p=1;p<=PHASES;p++){
          localStorage.removeItem(`albumPhase_v1_${p}`);
          localStorage.removeItem(`albumPhase_v2_${p}`);
        }
        console.warn('AlbumStore: cleared all');
      },
      dump(PHASES=8){
        const out={};
        for (let p=1;p<=PHASES;p++){
          out[`albumPhase_v1_${p}`]=_read(`albumPhase_v1_${p}`);
          out[`albumPhase_v2_${p}`]=_read(`albumPhase_v2_${p}`);
        }
        return out;
      }
    };
    // ?resetAlbum=1 で全消し
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('resetAlbum')==='1') {
        window.AlbumStoreTools.clearAll();
        alert('Album stores cleared.');
      }
    } catch {}
  }
})();
