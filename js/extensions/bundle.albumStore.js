/* =========================================================================
 * bundle.albumStore.js
 * Router + Bridge + StoreV1 + StoreV2 + Tools + RendererReadProxy + RendererGuard
 * -------------------------------------------------------------------------
 * 切替:  ?store=v1 | v2 | off     … 保存系の選択（localStorageにも保持）
 *        ?render=v1 | v2          … レンダラ優先権（任意。名称にv1/v2を含める）
 * 非常口:?resetAlbum=1            … 全保存キー削除
 * 参照:  window.readAlbumPhase(p) … アクティブ系のキーから読む（互換readは readAlbumPhaseCompat）
 * Tool:  window.AlbumStoreTools   … migrate/clear/dump 等
 * Guard: window.registerAlbumRenderer(name) を先頭で呼び、falseならスキップ
 * ========================================================================= */
(() => {
  // ------------------------------
  // 0) Utility
  // ------------------------------
  const _MAX = 12;
  const _isArr = (v) => Array.isArray(v);
  const _jsonRead = (k, def=[]) => { try{ const v=JSON.parse(localStorage.getItem(k)||'[]'); return _isArr(v)?v:def; }catch{ return def; } };
  const _jsonWrite = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };
  const _dedupCap = (arr, cap=_MAX) => {
    const seen=new Set(); const out=[];
    for(const x of arr){ if(!seen.has(x)){ seen.add(x); out.push(x); if(out.length>=cap) break; } }
    return out;
  };
  const _toRel = (s) => { // "./assets/..." 統一
    s = String(s||'');
    if (!s || s.startsWith('blob:') || s.startsWith('data:')) return '';
    try {
      const u = new URL(s, document.baseURI);
      const m = u.pathname.match(/\/assets\/.+/);
      return m ? '.' + m[0] : s;
    } catch {
      const i = s.indexOf('/assets/');
      return i >= 0 ? '.' + s.slice(i) : s;
    }
  };

  // ------------------------------
  // 1) Router: store(=v1|v2|off) / render(=v1|v2)
  // ------------------------------
  if (!window.__bundleAlbumStoreRouter) {
    window.__bundleAlbumStoreRouter = true;

    const url = new URL(location.href);
    const pickStore = (x)=> (x==='v1'||x==='v2'||x==='off')?x:null;
    const qStore = pickStore(url.searchParams.get('store'));
    const lsStore = pickStore(localStorage.getItem('ALBUM_STORE_ACTIVE'));
    const ACTIVE = qStore ?? lsStore ?? 'v2';

    localStorage.setItem('ALBUM_STORE_ACTIVE', ACTIVE);
    window.ALBUM_STORE_ACTIVE   = ACTIVE;
    window.__AlbumStoreDisabled = (ACTIVE === 'off');

    // render 強制（任意）
    const qRender = url.searchParams.get('render'); // 'v1' | 'v2' | null
    if (qRender === 'v1' || qRender === 'v2') window.__AlbumRendererForce = qRender;
  }

  // ------------------------------
  // 2) Renderer Guard: 単一登録 & 強制優先
  // ------------------------------
  if (!window.registerAlbumRenderer) {
    // 既定: 先着勝ち
    window.registerAlbumRenderer = function(name){
      if (window.__AlbumRendererRegistered) return false;
      window.__AlbumRendererRegistered = name || 'renderer';
      return true;
    };
  }
  // 強制優先に差し替え（?render= 指定時のみ）
  if (!window.__bundleAlbumRendererGuard) {
    window.__bundleAlbumRendererGuard = true;
    const orig = window.registerAlbumRenderer;
    window.registerAlbumRenderer = function(name){
      const want = window.__AlbumRendererForce; // 'v1'|'v2'|undefined
      if (!want) return orig(name);
      const tag = String(name||'').toLowerCase();
      const isV1 = tag.includes('v1');
      const isV2 = tag.includes('v2');
      if (!window.__AlbumRendererRegistered) {
        if ((want==='v1' && isV1) || (want==='v2' && isV2)) {
          window.__AlbumRendererRegistered = name || 'renderer';
          return true;
        }
      }
      return false; // 指名外はスキップ
    };
  }

  // ------------------------------
  // 3) Bridge: 旧イベント → v1/v2 に再送
  // ------------------------------
  if (!window.__bundleAlbumStoreBridge) {
    window.__bundleAlbumStoreBridge = true;
    window.addEventListener('prismcat:pair-match', (ev) => {
      const d = ev?.detail || {};
      const det = { phase: d.phase, src: d.src };
      window.dispatchEvent(new CustomEvent('prismcat:pair-match:v1', { detail: det }));
      window.dispatchEvent(new CustomEvent('prismcat:pair-match:v2', { detail: det }));
    }, { passive: true });
  }

  // ------------------------------
  // 4) Store V1（互換・そのまま保存）
  // ------------------------------
  if (!window.__bundleAlbumStoreV1 && !window.__AlbumStoreDisabled && window.ALBUM_STORE_ACTIVE==='v1') {
    window.__bundleAlbumStoreV1 = true;
    const K = (p) => `albumPhase_v1_${p}`;
    const onMatch = (ev) => {
      const d = ev?.detail || {};
      const phase = Number(d.phase||0);
      const src   = String(d.src||'');
      if (!phase || !src) return;
      const key = K(phase);
      const cur = _jsonRead(key);
      if (!cur.includes(src)) _jsonWrite(key, _dedupCap([...cur, src]));
    };
    window.addEventListener('prismcat:pair-match:v1', onMatch, { passive: true });
  }

  // ------------------------------
  // 5) Store V2（相対URL正規化＋重複排除）
  // ------------------------------
  if (!window.__bundleAlbumStoreV2 && !window.__AlbumStoreDisabled && window.ALBUM_STORE_ACTIVE==='v2') {
    window.__bundleAlbumStoreV2 = true;
    const K = (p) => `albumPhase_v2_${p}`;
    const onMatch = (ev) => {
      const d = ev?.detail || {};
      const phase = Number(d.phase||0);
      const src   = _toRel(d.src);
      if (!phase || !src) return;
      const key = K(phase);
      const cur = _jsonRead(key);
      if (!cur.includes(src)) _jsonWrite(key, _dedupCap([...cur, src]));
    };
    window.addEventListener('prismcat:pair-match:v2', onMatch, { passive: true });
  }

  // ------------------------------
  // 6) Renderer Read Proxy（描画の読み口を“常に正しいキー”へ）
  // ------------------------------
  if (!window.__bundleAlbumRendererReadProxy) {
    window.__bundleAlbumRendererReadProxy = true;

    const keyOf = (p) => `albumPhase_${window.ALBUM_STORE_ACTIVE||'v2'}_${p}`;

    // 正式：常にアクティブ系から読む
    window.readAlbumPhase = function(phase){
      return _jsonRead(keyOf(phase));
    };

    // 互換：まず正式 → もし空なら“逆系統”も覗く（見た目優先の保険）
    window.readAlbumPhaseCompat = function(phase){
      const a = window.readAlbumPhase(phase);
      if (a.length) return a;
      const other = (window.ALBUM_STORE_ACTIVE==='v2') ? `albumPhase_v1_${phase}` : `albumPhase_v2_${phase}`;
      return _jsonRead(other);
    };

    // 旧名で読んでいたコード用の alias
    window.getAlbumPhase = window.readAlbumPhase;
  }

  // ------------------------------
  // 7) Tools（移行・全削除・ダンプ・強制切替）
  // ------------------------------
  if (!window.__bundleAlbumStoreTools) {
    window.__bundleAlbumStoreTools = true;

    window.AlbumStoreTools = {
      migrateV1toV2(MAX=_MAX, PHASES=8){
        for (let p=1;p<=PHASES;p++){
          const v1 = _jsonRead(`albumPhase_v1_${p}`);
          const v2 = _jsonRead(`albumPhase_v2_${p}`);
          const merged = _dedupCap([...v2, ...v1.map(_toRel)], MAX);
          _jsonWrite(`albumPhase_v2_${p}`, merged);
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
          out[`albumPhase_v1_${p}`] = _jsonRead(`albumPhase_v1_${p}`);
          out[`albumPhase_v2_${p}`] = _jsonRead(`albumPhase_v2_${p}`);
        }
        return out;
      },
      // 即時切替（次回以降も維持）
      setActiveStore(mode/* 'v1'|'v2'|'off' */){
        if (mode!=='v1' && mode!=='v2' && mode!=='off') return false;
        localStorage.setItem('ALBUM_STORE_ACTIVE', mode);
        window.ALBUM_STORE_ACTIVE   = mode;
        window.__AlbumStoreDisabled = (mode==='off');
        console.warn('[AlbumStore] switched to', mode, '— reload to apply');
        return true;
      }
    };

    // 非常口: '?resetAlbum=1' で全削除
    try {
      const url = new URL(location.href);
      if (url.searchParams.get('resetAlbum') === '1') {
        window.AlbumStoreTools.clearAll();
        alert('Album stores cleared.');
      }
    } catch {}
  }

  // ------------------------------
  // 8) (任意) Render helper: 置き換え描画 & デバウンス
  //     既存レンダラから呼び出せる最小限の支援。使わなくてもOK。
  // ------------------------------
  if (!window.AlbumRenderHelpers) {
    window.AlbumRenderHelpers = {
      renderPhase(phase, container, reader = (window.readAlbumPhase||window.readAlbumPhaseCompat)){
        if (!container) return;
        const items = (reader)(phase) || [];
        container.replaceChildren(); // 累積禁止
        for (const src of items) {
          const img = new Image();
          img.decoding = 'async';
          img.loading  = 'lazy';
          img.src      = src;
          const card = document.createElement('div');
          card.className = 'album-thumb';
          card.appendChild(img);
          container.appendChild(card);
        }
      },
      makeRerender(callback){
        let raf=0;
        return ()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(callback); };
      }
    };
  }
})();
