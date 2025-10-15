// js/core.js
// - Index: <select id="pairSelect"> を localStorage と同期し、変更時に即リロード
// - Phase: リストボックスは使わず store.pairs を唯一のソースに（残っていれば削除）
// - 既存UI: #phaseList, #album, #toggleAlbum, #board, #timer などはそのまま利用

const SPEC_PATH_INDEX = './GameSpec.json';
const SPEC_PATH_PHASE = '../GameSpec.json';

const store = {
  get cleared() {
    try { return JSON.parse(localStorage.getItem('clearedPhases') || '[]'); }
    catch { return []; }
  },
  set cleared(v) { localStorage.setItem('clearedPhases', JSON.stringify(v)); },

  get pairs() { return Number(localStorage.getItem('pairs') || 3); },
  set pairs(n) { localStorage.setItem('pairs', String(n)); }
};

async function loadSpec(isIndex = false) {
  const url = isIndex ? SPEC_PATH_INDEX : SPEC_PATH_PHASE;
  const res = await fetch(url, { cache: 'no-store' });
  const spec = await res.json();

  const root = document.documentElement;
  root.style.setProperty('--card-size', (spec.ui?.cardSize ?? 180) + 'px');
  root.style.setProperty('--gap', (spec.ui?.gap ?? 12) + 'px');
  root.style.setProperty('--radius', (spec.ui?.radius ?? 12) + 'px');
  root.style.setProperty('--bg', spec.ui?.theme?.bg ?? '#0f1117');
  root.style.setProperty('--fg', spec.ui?.theme?.fg ?? '#e6e9ef');
  root.style.setProperty('--accent', spec.ui?.theme?.accent ?? '#ffcc66');

  return spec;
}

function imgTag(src) {
  const p = src.replace('.webp', '.png');
  const j = src.replace('.webp', '.jpg');
  return `<img src="${src}" loading="lazy"
           onerror="this.onerror=null; this.src='${p}'; this.onerror=function(){this.src='${j}'}">`;
}

/* =======================
   Index（フェーズ一覧）
   ======================= */
export async function buildIndex() {
  const spec   = await loadSpec(true);
  const list   = document.getElementById('phaseList');
  const album  = document.getElementById('album');
  const toggle = document.getElementById('toggleAlbum');
  const cleared = new Set(store.cleared || []);

  // --- リストボックス（3〜8）同期＆即リロード ---
  (function syncPairsSelectOnIndex(){
    const sel = document.getElementById('pairSelect');
    if (!sel) return;
    const current = Math.min(Math.max(store.pairs || 3, 3), 8);
    sel.value = String(current);
    sel.addEventListener('change', () => {
      const n = Number(sel.value);
      store.pairs = n;
      location.reload(); // シンプル＆確実
    });
  })();

  // アルバム（サムネ一覧）
  if (album) {
    album.innerHTML = `<div class="albumGrid">${
      spec.phases.map(ph => imgTag(`${spec.assets.imageBase}/${ph.cards.pattern}1.webp`)).join('')
    }</div>`;
  }
  toggle?.addEventListener('click', () => album?.classList.toggle('active'));

  // フェーズカード
  if (list) {
    list.innerHTML = spec.phases.map(ph => {
      const locked = ph.id > 1 && !cleared.has(ph.id - 1);
      const thumb  = `${spec.assets.imageBase}/${ph.cards.pattern}1.webp`;
      const lockAttr = locked
        ? 'onclick="alert(&#39;前のフェーズをクリアしてください&#39;);return false;"'
        : '';
      return `
        <div class="phaseItem">
          ${imgTag(thumb)}
          <div class="meta">
            <span class="title">Phase ${ph.id}：${ph.title}</span>
            <span class="badge">${ph.timeLimit}s</span>
            ${locked ? '<span class="badge">LOCK</span>' : ''}
            <span class="badge" style="margin-left:auto">${cleared.has(ph.id) ? 'CLEARED' : ''}</span>
            <a class="btn small" href="./phases/phase${ph.id}.html" ${lockAttr}>Play</a>
          </div>
        </div>`;
    }).join('');
  }
}

/* =======================
   Phase（ゲーム本体）
   ======================= */
export async function buildPhase(phaseId) {
  const spec = await loadSpec(false);
  const ph = spec.phases.find(p => p.id === phaseId);
  if (!ph) { document.body.innerHTML = '<p style="padding:20px">Invalid phase.</p>'; return; }

  // --- ゲーム画面にリストボックスが残っていたら除去 ---
  (function removePairsSelectOnPhase(){
    const sel = document.getElementById('pairSelect');
    if (sel && sel.parentNode) sel.parentNode.removeChild(sel);
    const lbl = document.querySelector('label[for="pairSelect"]');
    if (lbl && lbl.parentNode) lbl.parentNode.removeChild(lbl);
  })();

  // ヘッダ
  const titleEl = document.getElementById('phaseTitle');
  if (titleEl) titleEl.textContent = `Phase ${ph.id}：${ph.title}`;

  // 背景
  const bgFx = document.getElementById('bgFx');
  if (bgFx) bgFx.style.backgroundImage = `url('../${spec.assets.bgBase}/${ph.bg}')`;

  // 盤面
  const board = document.getElementById('board');
  if (!board) return;
  board.style.gridTemplateColumns =
    `repeat(${spec.ui.gridCols || 4}, minmax(var(--card-size),1fr))`;

  // --- ペア数は store.pairs を唯一のソースに（3..count へクランプ） ---
  const maxCount = Number(ph.cards.count) || 8;
  const pairs = Math.max(3, Math.min(store.pairs || 3, Math.max(3, maxCount)));
  const names = Array.from({ length: maxCount }, (_, i) => `${ph.cards.pattern}${i + 1}.webp`)
                     .slice(0, pairs);
  const urls  = names.map(n => `../${spec.assets.imageBase}/${n}`);

  const deck = shuffle([...urls, ...urls]).map((src, idx) => ({
    id: idx, src, key: src.split('/').pop(), matched: false
  }));

  board.innerHTML = deck.map(card => `
    <div class="card" data-key="${card.key}">
      <div class="inner">
        <div class="face front"></div>
        <div class="face back">${imgTag(card.src)}</div>
      </div>
    </div>
  `).join('');

  // ロジック
  let first = null, second = null, lock = false, matched = 0;
  const toast = (m) => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m; t.style.display = 'block';
    clearTimeout(t._tid); t._tid = setTimeout(() => (t.style.display = 'none'), 1200);
  };
  const lightbox = setupLightbox();

  board.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card || lock || card.classList.contains('matched')) return;

    card.classList.add('flipped');

    if (!first) { first = card; return; }
    if (card === first) return;

    second = card; lock = true;
    const ok = first.dataset.key === second.dataset.key;

    setTimeout(() => {
    if (ok) {
       [first, second].forEach(el => el.classList.add('matched'));
       matched++;
      // 画像URLを同時に通知（どのDOM構造でも拾えるように）
      const src =
        second.querySelector('.back img')?.src ||
        first .querySelector('.back img')?.src ||
        getComputedStyle(second.querySelector('.back')||{}).backgroundImage?.replace(/^url\(["']?|["']?\)$/g,'') ||
        '';
      window.dispatchEvent(new CustomEvent('prismcat:pair-match', {
        detail: { phase: ph.id, matched, src }
      }));
      const _lbSrc = src || '';
      lightbox.open(_lbSrc);
        setTimeout(() => lightbox.close(), 900);

        // クリア判定（pairs は store 由来）
        if (matched === pairs) {
          const c = new Set(store.cleared || []);
          c.add(ph.id);
          store.cleared = Array.from(c);
          toast('Complete!');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('prismcat:phase-complete', {
              detail: { phase: ph.id }
            }));
          }, 900);
        }
      } else {
        [first, second].forEach(el => el.classList.remove('flipped'));
      }
      first = null; second = null; lock = false;
    }, 420);
  });

  // タイマー
  const timeEl = document.getElementById('timer');
  if (timeEl) {
    if (ph.timeLimit > 0) {
      let remain = ph.timeLimit;
      timeEl.textContent = `${remain}s`;
      const iv = setInterval(() => {
        remain--;
        timeEl.textContent = `${remain}s`;
        if (remain <= 0) { clearInterval(iv); toast('Time up'); setTimeout(() => location.reload(), 600); }
      }, 1000);
    } else {
      timeEl.textContent = '∞';
    }
  }
}

/* 小物 */
function setupLightbox() {
  const el = document.getElementById('lightbox');
  const img = el?.querySelector('img');
  el?.addEventListener('click', () => el.classList.remove('open'));
  return {
    open: (src) => {
      if (!el || !img) return;
      // 既存レイアウトはそのまま、画像にだけ上限を適用
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.width     = 'auto';
      img.style.height    = 'auto';
      img.style.maxWidth  = 'var(--lb-max-w, 92vw)';
      img.style.maxHeight = 'var(--lb-max-h, 72vh)';
      img.style.objectFit = 'contain';
      img.src = src;
      el.classList.add('open');
    },
    close: () => el?.classList.remove('open')
  };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

window._PrismCatCore = { buildIndex, buildPhase };

// --- Album Jump（スマホ対応・内部スクロール対応） -----------------
function setupAlbumJump () {
  const album = document.getElementById('album');
  if (!album) return;

  const btn =
    document.getElementById('jumpAlbum') ||
    document.getElementById('toggleAlbum') ||
    document.querySelector('[data-album-jump]');
  if (!btn) return;

  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);

  const reveal = () => {
    if (album.hasAttribute('hidden')) album.removeAttribute('hidden');
    const cs = getComputedStyle(album);
    if (cs.display === 'none') album.style.display = 'block';
  };

  const getScrollParent = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
      p = p.parentElement;
    }
    return document.scrollingElement || document.documentElement || document.body;
  };

  const headerOffset = () => {
    const hdr = document.querySelector('.topbar, header[role="banner"], .header');
    return hdr ? hdr.offsetHeight : 0;
    };

  const jump = (ev) => {
    ev && ev.preventDefault && ev.preventDefault();
    if (document.body.classList.contains('click-lock')) return;

    reveal();

    const scroller = getScrollParent(album);
    try { album.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch {}

    requestAnimationFrame(() => {
      const rectAlbum  = album.getBoundingClientRect();
      const rectScroll = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0 };
      const yCurrent   = scroller === (document.scrollingElement || document.documentElement || document.body)
        ? (window.scrollY || window.pageYOffset || 0)
        : scroller.scrollTop;
      const top = yCurrent + (rectAlbum.top - rectScroll.top) - headerOffset() - 8;
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  };

  if (clone.tagName === 'A') clone.setAttribute('href', 'javascript:void 0');
  clone.addEventListener('click', jump, { passive: false });
}
// ---------------------------------------------------------------------
