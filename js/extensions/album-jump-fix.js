// album-jump-fix.js — スマホでも確実に「アルバムへ」ジャンプ
(function () {
  "use strict";

  // 例外で止まらないよう全体をtryで囲む
  try {
    // 後方互換：passive オプション対応有無
    const supportsPassive = (() => {
      let ok = false;
      try {
        const opts = Object.defineProperty({}, "passive", {
          get() { ok = true; }
        });
        window.addEventListener("test", null, opts);
        window.removeEventListener("test", null, opts);
      } catch (_) {}
      return ok;
    })();

    const opt = supportsPassive ? { passive: false } : false;

    // DOM構築後に初期化
    const boot = () => {
      const target =
        document.getElementById("album") ||
        document.querySelector("[data-album], section.album");

      // ボタン候補を広めに拾う（id / data属性 / a[href="#album"] など）
      const btn =
        document.getElementById("albumJump") ||
        document.getElementById("toggleAlbum") ||
        document.querySelector("[data-album-jump]") ||
        document.querySelector('a[href="#album"]');

      if (!target || !btn) return; // どちらか無ければ何もしない（エラーも出さない）

      // 旧トグルJSがpreventDefault等していても自前でスクロール
      const jump = (ev) => {
        try {
          // クリック禁止時間（click-lock）中は無視
          if (document.body.classList.contains("click-lock")) {
            ev && ev.preventDefault && ev.preventDefault();
            return;
          }

          // 非表示なら可視化（hidden/display:none の両対応）
          if (target.hasAttribute("hidden")) target.removeAttribute("hidden");
          const cs = window.getComputedStyle(target);
          if (cs.display === "none") {
            // 一度だけ元displayを保存し、可視化
            if (!target.dataset.oldDisplay) target.dataset.oldDisplay = "";
            target.style.display = target.dataset.oldDisplay || "block";
          }

          // 固定ヘッダーの高さを考慮してオフセットスクロール
          const header = document.querySelector(".topbar");
          const headerH = header ? header.offsetHeight : 0;
          const rect = target.getBoundingClientRect();
          const y = (window.scrollY || window.pageYOffset) + rect.top - headerH - 8;

          ev && ev.preventDefault && ev.preventDefault();
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });

          // 視認性アップ（任意の軽いハイライト）
          target.classList.add("album-ping");
          setTimeout(() => target.classList.remove("album-ping"), 600);
        } catch (e) {
          // ここで落ちても全体は止めない
          console.debug("[album-jump] failed:", e);
        }
      };

      // aタグなら # を無効化して自前で制御
      if (btn.tagName === "A") btn.setAttribute("href", "javascript:void 0");

      // 旧ハンドラの副作用を減らすため、onclick直付けは消す
      try { btn.onclick = null; } catch (_) {}

      // iOSでも確実に拾うよう、pointer/click/touch を全部
      btn.addEventListener("pointerdown", jump, opt);
      btn.addEventListener("touchstart", jump, opt);
      btn.addEventListener("click", jump, opt);

      // 目標側に scroll-margin-top を付与（CSSが無い場合の保険）
      try {
        const h = (document.querySelector(".topbar")?.offsetHeight || 0) + 8;
        target.style.scrollMarginTop = h + "px";
      } catch (_) {}
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
      boot();
    }
  } catch (e) {
    // どんな環境でもエラーでページを止めない
    console.debug("[album-jump] init error:", e);
  }
})();
