// Index の #album を localStorage から安定描画
// ---- single renderer guard ----
if (window.__AlbumRendererRegistered) {
  // すでに別レンダラーが登録済みなら、このファイルは何もしない
  // console.debug('render-album.js: skipped (renderer already registered)');
} else {
  window.__AlbumRendererRegistered = 'render-album';
}


(function(){
  const albumRoot = document.getElementById('album');
  if (!albumRoot) return;

  // /PrismCat_Memory/ 配下でも相対で解決できるよう、先頭の / を避ける
  const ROOT = (function(){
    // 例: https://user.github.io/PrismCat_Memory/...
    const m = location.pathname.match(/^\/([^\/]+)\//);
    return m ? `/${m[1]}/` : '/';
  })();

  // phases 数はUIから推定（無ければ5）
  const phases = document.querySelectorAll('#phaseList .phaseItem').length || 5;

  function read(p){
    try { return JSON.parse(localStorage.getItem(`albumPhase_${p}`) || '[]'); }
    catch { return []; }
  }

  function normSrc(src){
    // 先頭 /assets… を ./assets… に変換（ルート依存を消す）
    if (/^\/assets\//.test(src)) return `.${src}`;
    return src;
  }

  function render(){
    const wrap = document.createElement('div');
    wrap.className = 'album-shelf';
    for(let p=1; p<=phases; p++){
      let items = read(p).slice(0, 12).map(normSrc);
      items.sort((a,b)=>a.localeCompare(b)); // 安定化
      const MAX = 12;
      const cells = [];
      for(let i=0;i<MAX;i++){
        const s = items[i];
        cells.push(s ? (
          `<a class="album-item" href="${s}" target="_blank" rel="noopener">
            <img src="${s}" alt="phase${p}-${i+1}" width="320" height="320" loading="lazy" decoding="async">
          </a>`
        ) : `<div class="album-item is-placeholder" aria-hidden="true"></div>`);
      }
      wrap.insertAdjacentHTML('beforeend', `
        <section class="album-phase">
          <h3 class="album-phase__title">Phase ${p}</h3>
          <div class="album-grid">${cells.join('')}</div>
        </section>
      `);
    }
    albumRoot.innerHTML = '';
    albumRoot.appendChild(wrap);
  }

  // ページが完全に安定してから描画（Pages遅延/画像プリロードの揺れを回避）
  function safeRender(){
    const run = ()=> {
      requestAnimationFrame(()=> {
        setTimeout(render, 0);
      });
    };
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run, {once:true});
  }

  safeRender();
  // タブ復帰や保存キュー消化後に再描画したいとき用
  window.addEventListener('pageshow', safeRender);
})();
