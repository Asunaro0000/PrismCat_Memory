// phase-nav-arrows.js — 強化版（確実にページめくり）
// 1) サムネ候補を広く収集（img,a,button）
// 2) クリック再利用（優先）→ 失敗ならLightbox画像を直接差し替え（フォールバック）
// 3) 押下範囲は◀▶ボタンのみ。背景タップで閉じる挙動は維持。

(function(){
  const ready = (fn)=>document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded', fn, {once:true}) : fn();

  const qs  = (s,r=document)=>r.querySelector(s);
  const qsa = (s,r=document)=>Array.from(r.querySelectorAll(s));

  // ---- Album items: できるだけ広く拾う ----
// 置き換え：getAlbumItems（phase-nav-arrows.js内）
function getAlbumItems(){
  // 1) すべての #album を収集（id重複対策）
  const albums = Array.from(document.querySelectorAll('#album')).filter(a => a);

  // 2) 各アルバムから img を集める（可視だけ）
  const pickImgs = (root) => Array.from(root.querySelectorAll('img'))
    .filter(el => el && el.offsetParent !== null);

  // 3) 画像が最も多い #album を優先（実表示側を選ぶ）
  let best = [];
  for (const a of albums){
    const imgs = pickImgs(a);
    if (imgs.length > best.length) best = imgs;
  }

  // 4) 最低限、どこにもなければページ全体から拾う（安全網）
  if (best.length === 0) {
    best = Array.from(document.querySelectorAll('#album img, .album img, img[data-full]'))
      .filter(el => el && el.offsetParent !== null);
  }
  return best;
}


  // フル画像URLを推定
  function fullUrl(el){
    if(!el) return '';
    // <a> なら href を優先
    if (el.tagName === 'A' && el.getAttribute('href')) return el.href;
    // data-full / data-src / currentSrc / src
    const img = (el.tagName==='IMG') ? el : el.querySelector('img');
    return el.getAttribute('data-full')
        || el.getAttribute('data-src')
        || (img && (img.getAttribute('data-full')||img.currentSrc||img.src))
        || el.currentSrc || el.src || '';
  }
  // その要素をクリック開きする“トリガ要素”
  function openTrigger(el){
    return (el.closest && el.closest('a,button,[data-open-lb]')) || el;
  }

  // ---- Lightbox ----
  function lb(){ return qs('#lightbox'); }
  function lbImg(){
    const L = lb(); if(!L) return null;
    return L.querySelector('.frame img, img');
  }
  function isOpen(){ const L=lb(); return !!(L && L.classList.contains('open')); }

  // 現在index（末尾ファイル名 or フルURLで照合）
  function getIndex(){
    const items = getAlbumItems();
    const img = lbImg();
    if(!items.length || !img) return -1;
    const file = u => (u||'').split(/[?#]/)[0].split('/').pop();
    const curFull = (img.currentSrc || img.src || '');
    const curFile = file(curFull);
    // 1) フルで一致 2) 末尾ファイル名で一致 の順に
    for(let i=0;i<items.length;i++){
      const f = fullUrl(items[i]);
      if (f && f === curFull) return i;
    }
    for(let i=0;i<items.length;i++){
      const f = fullUrl(items[i]);
      if (f && file(f) === curFile) return i;
    }
    return -1;
  }

  // indexを開く：クリック再利用→フォールバック
  function openByIndex(idx){
    const items = getAlbumItems();
    if(!items.length) return;
    const n = ((idx % items.length)+items.length)%items.length;
    const target = items[n];
    const trg = openTrigger(target);

    // クリック再利用（最優先）
    const ok = trg.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));

    // クリックで開かなかった/無視された場合はフォールバックで直接差し替え
    setTimeout(()=> {
      if (!isOpen()) return; // クリックで既に開けた
      const img = lbImg();
      if (!img) return;
      const url = fullUrl(target);
      if (!url) return;
      img.src = url; // 画像差し替え
      // キャプション更新が別JSの場合は、ファイル名一致で十分に動くことが多い
      // それでも必要なら、カスタムイベントを発火してキャプション側に更新合図
      document.dispatchEvent(new CustomEvent('lb:navigate',{detail:{url, index:n}}));
    }, 30);
  }

  // ---- UI注入（◀▶ボタンだけ押せる）----
  function ensureUI(){
    const L = lb();
    if (!L || L.dataset.navArrows==='1') return;
    L.dataset.navArrows='1';

    const css = `
    #lightbox .lb-nav{ position:absolute; inset:0; pointer-events:none; }
    #lightbox .lb-btn{
      position:absolute; top:50%; transform:translateY(-50%);
      width:52px; height:52px; border-radius:999px;
      display:grid; place-items:center;
      background:rgba(0,0,0,.55); color:#fff;
      border:1px solid rgba(255,255,255,.2);
      box-shadow:0 6px 16px rgba(0,0,0,.35);
      font-size:20px; font-weight:700; line-height:1;
      pointer-events:auto; cursor:pointer;
      transition:transform .12s ease, opacity .12s ease;
    }
    #lightbox .lb-btn.left { left:12px; }  #lightbox .lb-btn.right{ right:12px; }
    #lightbox .lb-btn:active{ transform:translateY(-50%) scale(.96); opacity:.9; }
    @media (max-width:900px){ #lightbox .lb-btn{ width:46px; height:46px; font-size:18px; } }
    `;
    const st = document.createElement('style');
    st.id='lb-arrow-style-solid';
    st.textContent = css;
    document.head.appendChild(st);

    const nav = document.createElement('div'); nav.className='lb-nav';
    const Lbtn = document.createElement('button'); Lbtn.className='lb-btn left';  Lbtn.textContent='◀';
    const Rbtn = document.createElement('button'); Rbtn.className='lb-btn right'; Rbtn.textContent='▶';
    nav.appendChild(Lbtn); nav.appendChild(Rbtn);
    L.appendChild(nav);

    const go = (d)=>{ const i=getIndex(); if(i<0) return; openByIndex(i+d); };
    Lbtn.addEventListener('click', e=>{ e.stopPropagation(); go(-1); });
    Rbtn.addEventListener('click', e=>{ e.stopPropagation(); go(+1); });

    // キー操作
    document.addEventListener('keydown', e=>{
      if (!isOpen()) return;
      if (e.key==='ArrowLeft')  { e.preventDefault(); go(-1); }
      if (e.key==='ArrowRight') { e.preventDefault(); go(+1); }
    });

    // スワイプ
    let sx=0, sy=0, moved=false;
    L.addEventListener('touchstart', e=>{ const t=e.changedTouches[0]; sx=t.clientX; sy=t.clientY; moved=false; }, {passive:true});
    L.addEventListener('touchmove', ()=>{ moved=true; }, {passive:true});
    L.addEventListener('touchend', e=>{
      if (!moved) return;
      const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
      if (Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)) go(dx<0 ? +1 : -1);
    }, {passive:true});
  }

  ready(()=>{
    const L = lb(); if(!L) return;
    ensureUI();
    const mo = new MutationObserver(()=> ensureUI());
    mo.observe(L, {attributes:true, attributeFilter:['class'], childList:true, subtree:true});
  });
})();
