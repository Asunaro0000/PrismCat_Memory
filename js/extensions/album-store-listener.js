// 安全な保存（書き込み競合・遅延・bfcacheを考慮）
(function () {
  const MAX_PER_PHASE = 12;
  const Q = [];    // 待ち行列
  let busy = false;
  const K = (p) => `albumPhase_${p}`;

  function read(p){
    try { return JSON.parse(localStorage.getItem(K(p)) || '[]'); }
    catch { return []; }
  }
  function write(p, arr){
    try { localStorage.setItem(K(p), JSON.stringify(arr)); return true; }
    catch { return false; }
  }

  // 非同期で順序保証しながら保存
  async function flush(){
    if (busy) return;
    busy = true;
    while (Q.length){
      const {phase, src} = Q.shift();
      const cur = read(phase);
      if (cur.includes(src) || cur.length >= MAX_PER_PHASE) continue;
      cur.push(src);
      if (!write(phase, cur)){
        // 書けなかった（Quota/タイミング）→ 少し待って再試行
        await new Promise(r => setTimeout(r, 50));
        Q.unshift({phase, src}); // 先頭に戻す
        break;
      }
    }
    busy = false;
  }

  function enqueue(phase, src){
    if (!phase || !src) return;
    // blob: は表示で困るので拒否（相対 or 絶対URLだけにする）
    if (String(src).startsWith('blob:')) return;
    Q.push({phase, src});
    // DOMが落ち着くまで少し遅らせる（Pagesの遅延対策）
    requestIdleCallback ? requestIdleCallback(flush, {timeout: 200}) :
    setTimeout(flush, 0);
  }

  // ゲーム側イベントから取り込む（core.js が投げる）
  window.addEventListener('prismcat:pair-match', (ev) => {
    const d = ev?.detail || {};
    enqueue(Number(d.phase || 0), String(d.src || ''));
  }, {passive: true});

  // タブ復帰/ページ表示時にも未処理があれば流す
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });
  window.addEventListener('pageshow', flush);
})();






(function(){
  if (window.__albumSaveInit) return; window.__albumSaveInit = true;

  const key = p => `albumPhase_${p}`;

  function getArr(p){
    try{
      const raw = localStorage.getItem(key(p));
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) return arr;
    }catch(_) {}
    // 破損/未作成なら初期化
    localStorage.setItem(key(p), '[]');
    return [];
  }

  function setArr(p, arr){
    try { localStorage.setItem(key(p), JSON.stringify(arr)); }
    catch(e){ console.warn('[SAVE ERROR]', e.name, e.message); }
  }

  function toRelative(src){
    if (!src) return '';
    let s = String(src);
    // GitHub Pages の絶対URL → 相対に寄せる
    s = s.replace(/^https?:\/\/asunaro0000\.github\.io\/PrismCat_Memory\//, './');
    // 汎用：/RepoName/assets または /assets → ./assets
    s = s.replace(/^\/[^/]+\/assets\//,'./assets/').replace(/^\/assets\//,'./assets/');
    return s;
  }

  window.addEventListener('prismcat:pair-match', (ev)=>{
    const d = ev?.detail || {};
    const phase = Number(d.phase||0);
    const src   = toRelative(d.src);
    if (!phase || !src || src.startsWith('blob:')) return;

    const arr = getArr(phase);          // ★ 未作成でも必ず [] を返す
    if (!arr.includes(src) && arr.length < 12){
      arr.push(src);
      setArr(phase, arr);               // ★ ここで初回でもキーが作られる
      console.log('[SAVED]', key(phase), 'count=', arr.length, 'last=', src);
    } else {
      console.log('[SKIP]', {phase, len:arr.length, dup:arr.includes(src)});
    }
  }, {passive:true});
})();

