// album-jump.js — トグル廃止→「アルバムへ」ジャンプ（スマホ対応：親スクロール自動検出）
(() => {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // スクロール復元を無効化（保険）
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch {}

  // 固定ヘッダーの高さ
  const headerOffset = () => {
    const hdr = document.querySelector(".topbar, header[role='banner'], .header");
    return hdr ? Math.ceil(hdr.getBoundingClientRect().height) : 0;
  };

  // スクロール親を自動検出（内部スクロール対応）
  const getScrollParent = (el) => {
    let p = el?.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      const oy = s.overflowY;
      if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) {
        return p; // 内部スクロールの親
      }
      p = p.parentElement;
    }
    return document.scrollingElement || document.documentElement || document.body; // window
  };

  // album を可視化（hidden / display:none の両対応）
  const revealAlbum = (album) => {
    if (album.hasAttribute("hidden")) album.removeAttribute("hidden");
    const cs = getComputedStyle(album);
    if (cs.display === "none") album.style.display = "block";
  };

  // スムーズスクロール（親要素に対して）
  const scrollerScrollTo = (scroller, y) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = Math.max(0, y);
    try {
      scroller.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    } catch {
      scroller.scrollTop = top;
    }
  };

  // 目的要素までスクロール（内部/外部の両方に対応）
  const jumpToAlbum = (album) => {
    revealAlbum(album);

    const scroller = getScrollParent(album);
    const headerH = headerOffset();

    // まず近くまで（iOSの取りこぼし対策）
    try { album.scrollIntoView({ behavior: "auto", block: "start" }); } catch {}

    // 次フレームで正確に補正
    requestAnimationFrame(() => {
      const rectAlbum = album.getBoundingClientRect();
      const rectScroll = scroller.getBoundingClientRect
        ? scroller.getBoundingClientRect()
        : { top: 0 };
      const baseTop = rectScroll.top || 0;
      const current = scroller === (document.scrollingElement || document.documentElement || document.body)
        ? (window.scrollY || window.pageYOffset || 0)
        : (scroller.scrollTop || 0);

      const y = current + (rectAlbum.top - baseTop) - headerH - 8;
      scrollerScrollTo(scroller, y);

      // アクセシビリティ：フォーカスを当てる（スクロールは起こさない）
      album.setAttribute("tabindex", "-1");
      setTimeout(() => { try { album.focus({ preventScroll: true }); } catch {} }, 300);

      // 視認性の軽いハイライト（CSS側に .album-ping があれば効く）
      album.classList.add("album-ping");
      setTimeout(() => album.classList.remove("album-ping"), 600);
    });
  };

  ready(() => {
    const album = document.getElementById("album");
    const btnOrig = document.getElementById("toggleAlbum"); // 既存の「アルバム切替」ボタン
    if (!album || !btnOrig) return;

    // アルバムは常時表示に固定
    album.hidden = false;
    album.classList.add("active");
    ["is-hidden","hidden","collapsed","closed","locked"].forEach(c => album.classList.remove(c));

    // 区切りUIを削除
    document.querySelectorAll(".section-divider, #scrollDownHint, .scroll-down-hint").forEach(el => el.remove());

    // 既存トグルのイベントを剥がしてジャンプ化
    const btn = btnOrig.cloneNode(true);
    btnOrig.replaceWith(btn);
    btn.id = "jumpAlbum";
    btn.textContent = "アルバムへ";
    btn.setAttribute("aria-label", "アルバムへ");

    // スマホ取りこぼしを避けて click のみで制御（touchstartは使わない）
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (document.body.classList.contains("click-lock")) return;
      jumpToAlbum(album);
    }, { passive: false });

    // 自動ジャンプは行わない（URLの #album を無視）
  });
})();


// ---- アルバムのレイアウトを強制更新（モバイルのdisplay切替/URLバー伸縮対策）
(function(){
  const raf2 = (fn)=>{ let id; return ()=>{ cancelAnimationFrame(id);
    id = requestAnimationFrame(()=>requestAnimationFrame(fn)); }; };

  function computeThumbWidth() {
    const vw = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
    // 端末幅で少しだけ調整。必要なら好みに合わせて。
    return vw >= 900 ? 120 : vw >= 600 ? 110 : 100;
  }

  window.refreshAlbumLayout = function refreshAlbumLayout() {
    const album = document.getElementById('album');
    if (!album) return;
    // どちらの実装でも拾えるように候補を用意
    const grid =
      album.querySelector('.album-v2') ||
      album.querySelector('.album-grid') ||
      album.querySelector('.grid');
    if (!grid) return;

    // 強制リフロー → CSS 変数更新
    void album.offsetHeight;                       // reflow
    grid.style.setProperty('--album-thumb', computeThumbWidth() + 'px');
  };

  // 画面サイズ/向き変更・ビューポート変化で更新
  const rerender = raf2(window.refreshAlbumLayout);
  window.addEventListener('resize', rerender, { passive: true });
  window.addEventListener('orientationchange', rerender);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', rerender, { passive: true });
  }

  // album 自体のサイズ変化を監視
  const album = document.getElementById('album');
  if (album && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(rerender);
    ro.observe(album);
  }

  // ページ再表示時（bfcache復帰）も更新
  window.addEventListener('pageshow', rerender);
})();

