// phases-footer-row.js  — 180s / CLEARED / LOCK / Play を必ず1行にまとめる
(function () {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  function waitFor(selector, cb, limit = 3000) {
    const t0 = performance.now();
    (function loop() {
      const el = document.querySelector(selector);
      if (el) return cb(el);
      if (performance.now() - t0 > limit) return;
      requestAnimationFrame(loop);
    })();
  }

  function norm(txt) {
    return (txt || "").replace(/\s+/g, "").toLowerCase();
  }

  ready(() => {
    waitFor("#phaseList .phaseItem .meta", () => {
      document.querySelectorAll("#phaseList .phaseItem .meta").forEach((meta) => {
        if (meta.querySelector(".status-row")) return; // 済

        // タイトル候補
        const title =
          meta.querySelector(".title, h1, h2, h3, h4, h5, h6, strong") ||
          meta.firstElementChild;

        // アクション（Play）
        const actionBtn = Array.from(meta.querySelectorAll("a,button")).find((el) =>
          norm(el.textContent).includes("play")
        );

        // バッジ候補（180s / CLEARED / LOCK）
        const badgeCandidates = Array.from(meta.querySelectorAll("*")).filter((el) => {
          if (!(el instanceof HTMLElement)) return false;
          if (!meta.contains(el)) return false;
          if (el === actionBtn) return false;               // Playは除外
          const t = norm(el.textContent);
          if (!t) return false;
          return /^\d+s$/.test(t) || t.includes("cleared") || t.includes("lock");
        });

        if (!actionBtn && badgeCandidates.length === 0) return;

        // ラッパー生成
        const row = document.createElement("div");
        row.className = "status-row";

        const left = document.createElement("div");
        left.className = "status-left";
        badgeCandidates.forEach((el) => left.appendChild(el));
        if (left.childElementCount) row.appendChild(left);

        if (actionBtn) {
          const right = document.createElement("div");
          right.className = "status-right";
          // Playに .play クラスを付与（スタイル当てやすく）
          actionBtn.classList.add("play");
          right.appendChild(actionBtn);
          row.appendChild(right);
        }

        // タイトル直後へ
        if (title && title.parentElement === meta) {
          title.insertAdjacentElement("afterend", row);
        } else {
          meta.appendChild(row);
        }

        // 取り出し元に空のラッパーが残っていたら掃除
        Array.from(meta.children).forEach((el) => {
          if (el === title || el === row) return;
          // 要素子が無く、テキストも空白のみなら削除
          if (el.children.length === 0 && !el.textContent.trim()) el.remove();
        });
      });
    });
  });
})();
