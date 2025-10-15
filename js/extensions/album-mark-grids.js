// album-mark-grids.js：アルバム内の“画像グリッド”に .album-grid を後付け
(function () {
  const onReady = (fn)=>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();

  onReady(() => {
    const album = document.querySelector('#album');
    if (!album) return;

    const root = album.firstElementChild || album;
    // 画像が含まれる div を“グリッド”とみなしてクラス付与
    root.querySelectorAll('div').forEach(div => {
      if (div.querySelector('img')) div.classList.add('album-grid');
    });
  });
})();


