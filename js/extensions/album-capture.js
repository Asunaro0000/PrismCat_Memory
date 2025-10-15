// album-capture.js (強制キャプチャ版)：コア無改変で確実に保存
(function () {
  const onReady = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  onReady(async () => {
    // phase番号をURLから取得
    const m = location.pathname.match(/phase(\d+)\.html/);
    const phaseId = m ? Number(m[1]) : 0;
    if (!phaseId) {
      console.warn("[Album] phaseId not detected:", location.pathname);
    }

    const board =
      document.querySelector("#board") ||
      document.querySelector(".board") ||
      document.querySelector(".cards") ||
      document.querySelector("main");
    if (!board) {
      console.warn("[Album] No board found.");
      return;
    }

    // GameSpecのカードパターンを取得（画像が見つからない場合の保険）
    let spec = null, pattern = null, imgBase = "";
    try {
      const path = "../GameSpec.json";
      spec = await fetch(path).then((r) => r.json());
      const ph = (spec?.phases || []).find((p) => Number(p.id) === Number(phaseId));
      if (ph) {
        const cardsKey = ph.cards || ph.map?.cards;
        const meta = spec?.materials?.assets?.cards?.[cardsKey] || spec?.assets?.cards?.[cardsKey];
        pattern = meta?.pattern || null;
        imgBase =
          (spec?.materials?.assets?.image_base || spec?.assets?.image_base || "assets/image")
            .replace(/\/+$/, "");
      }
    } catch (e) {
      // 読み込み失敗は無視（後段のDOM探索で拾う）
    }

    const key = `albumPhase_${phaseId}`;
    const saved = new Set(JSON.parse(localStorage.getItem(key) || "[]"));

    const saveImage = (src) => {
      if (!src || saved.has(src) || saved.size >= 8) return;
      saved.add(src);
      localStorage.setItem(key, JSON.stringify([...saved]));
      console.log(`[Album] saved (${key}):`, src);
    };

    // 画像URLを可能な限り取り出す
    const extractImgSrc = (cardEl) => {
      // 1) DOMから直接探す
      const img =
        cardEl.querySelector(".back img, .front img, .face img, img");
      if (img?.src) return img.src;

      // 2) パターン＋data-idから復元（フォールバック）
      const id = cardEl?.dataset?.id;
      if (pattern && id) {
        // 拡張子が既に含まれていればそのまま。無ければ .webp とする
        let stem = pattern.replace("{n}", String(id));
        let hasExt = /\.(webp|png|jpg|jpeg|gif|avif)$/i.test(stem);
        return `${location.pathname.includes("/phases/") ? "../" : "./"}${imgBase}/${stem}${hasExt ? "" : ".webp"}`;
      }
      return null;
    };

    // ---- ここがキモ：classList.add をフックして matched を確実に捕まえる ----
    const origAdd = DOMTokenList.prototype.add;
    DOMTokenList.prototype.add = function (...tokens) {
      try {
        const el = this._ownerElement || this.ownerElement || (this._element || null);
        const target = el || (this.contains && this); // best effort
        const result = origAdd.apply(this, tokens);

        if (!target || !(target instanceof Element)) return result;
        // .card に matched が付いた瞬間
        if (
          tokens.includes("matched") &&
          (target.classList?.contains("card") || target.closest?.(".card"))
        ) {
          const cardEl = target.classList?.contains("card")
            ? target
            : target.closest(".card");
          const src = extractImgSrc(cardEl);
          if (src) saveImage(src);
        }
        return result;
      } catch (e) {
        // 失敗しても通常動作は壊さない
        return origAdd.apply(this, tokens);
      }
    };
    // DOMTokenList から対象Elementを引けるようにパッチ（ブラウザ差対策）
    try {
      if (!("ownerElement" in DOMTokenList.prototype)) {
        Object.defineProperty(DOMTokenList.prototype, "ownerElement", {
          configurable: true,
          get() {
            try { return this._ownerElement || this.__owner || this[Symbol.for("owner")] || this._element || null; }
            catch { return null; }
          },
        });
      }
    } catch {}

    // 既存カードも監視（matched を後付けする実装に備える）
    const obs = new MutationObserver((muts) => {
      muts.forEach((mu) => {
        if (mu.attributeName !== "class") return;
        const el = mu.target;
        if (!el.classList?.contains("card")) return;
        if (!el.classList.contains("matched")) return;
        const src = extractImgSrc(el);
        if (src) saveImage(src);
      });
    });
    board.querySelectorAll(".card").forEach((c) =>
      obs.observe(c, { attributes: true, attributeFilter: ["class"] })
    );

    console.log(`[Album] capture strong-mode ready (Phase ${phaseId})`);
  });
})();


