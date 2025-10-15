// 各フェーズのアルバムを8枠構成で表示（GameSpec.jsonのphases構造に対応）
// - 再入OK（重複描画ガード）
// - localStorage: ["url", ...] でも [{src:"url"}, ...] でもOK
// - 戻る（bfcache）/別タブ更新/タブ復帰で自動リフレッシュ

// ---- single renderer guard ----
if (window.__AlbumRendererRegistered) {
  // すでに別レンダラーが登録済みなら、このファイルは何もしない
  // console.debug('album-fill.js: skipped (renderer already registered)');
  //return;
}
window.__AlbumRendererRegistered = 'album-fill';


(function () {
  const onReady = (fn) =>
    (document.readyState === "loading")
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // 重複描画ガード用の簡易ハッシュ
  let _albumHash = '';
  const calcHash = (data) => {
    try { return JSON.stringify(data); } catch { return String(Math.random()); }
  };

  // localStorage からキーごとに src の配列へ正規化
  function readPhaseItems(key) {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { raw = []; }
    if (!Array.isArray(raw)) return [];

    // "url" か {src:"url"} / {url:"..."} に対応
    return raw
      .map(v => (typeof v === 'string') ? v : (v && (v.src || v.url)) || '')
      .filter(Boolean)
      .slice(0, 8);
  }

  async function fetchSpec() {
    try {
      const r = await fetch('./GameSpec.json', { cache: 'no-store' });
      if (!r.ok) throw 0;
      return await r.json();
    } catch {
      return null;
    }
  }

  async function fillAlbum() {
    const album = document.querySelector('#album');
    if (!album) return;

    const spec = await fetchSpec();
    if (!spec) return;

    const phases = spec.phases || [];

    // 次に描く内容のハッシュを先に作る（localStorageの中身も含める）
    const snapshot = phases.map(ph => ({
      id: ph.id,
      title: ph.title || `Phase ${ph.id}`,
      items: readPhaseItems(`albumPhase_${ph.id}`)
    }));
    const nextHash = calcHash(snapshot);
    if (nextHash === _albumHash) return; // 前回と同じなら何もしない
    _albumHash = nextHash;

    // クリア & 再構築
    album.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gap = '16px';
    album.appendChild(wrap);

    // セル基準（必要なら数値を調整）
    const CELL_W = 120;
    const CELL_H = 90;

    for (const ph of phases) {
      const phaseId = ph.id;
      const title   = ph.title || `Phase ${phaseId}`;
      const key     = `albumPhase_${phaseId}`;

      const items = readPhaseItems(key); // 正規化済み src[]

      // 見出し
      const titleEl = document.createElement('div');
      titleEl.className = 'album-title';
      titleEl.setAttribute('data-role', 'album-title');
      titleEl.textContent = `Phase ${phaseId}：${title}`;
      titleEl.style.fontWeight = '700';
      titleEl.style.margin = '6px 0 2px';
      wrap.appendChild(titleEl);

      // 8枠グリッド
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
      grid.style.gap = '8px';
      wrap.appendChild(grid);

      for (let i = 0; i < 8; i++) {
        const cell = document.createElement('div');
        cell.style.width = CELL_W + 'px';
        cell.style.height = CELL_H + 'px';
        cell.style.borderRadius = '10px';
        cell.style.overflow = 'hidden';
        cell.style.border = '1px solid rgba(255,255,255,.12)';
        cell.style.background = 'rgba(255,255,255,.04)';
        cell.style.display = 'grid';
        cell.style.placeItems = 'center';

        const src = items[i];
        if (src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = `Phase ${phaseId} ${i + 1}`;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.display = 'block';
          img.style.objectFit = 'cover';
          cell.appendChild(img);
        }
        grid.appendChild(cell);
      }
    }
  }

  // 初回
  onReady(fillAlbum);

  // Back/Forward Cache 復帰やタブ復帰、別タブ更新で再描画
  window.addEventListener('pageshow', fillAlbum);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fillAlbum();
  });
  window.addEventListener('storage', (e) => {
    if (!e.key) return;
    if (e.key.startsWith('albumPhase_') || e.key === 'albumDirty') fillAlbum();
  });

  // 任意：同一ページ内からの手動通知（album-capture.js等から）
  window.addEventListener('album:updated', fillAlbum);
})();


(function(){
  // bfcache復帰／戻る進む判定／フラグのいずれかで発火
  function shouldReloadOnBack(){
    if (sessionStorage.getItem('needRefresh') === '1') return true;
    if ('onpageshow' in window && window.performance) {
      const nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'back_forward') return true;
    }
    return false;
  }

  window.addEventListener('pageshow', function(e){
    // bfcache復帰でも動く。1回だけリロードしてフラグを掃除
    if (e.persisted || shouldReloadOnBack()){
      sessionStorage.removeItem('needRefresh');
      // 無限ループ防止のため、初回ロードには影響しない
      setTimeout(()=>location.reload(), 60);
    }
  });
})();


