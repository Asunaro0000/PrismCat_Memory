
// /js/extensions/debug-album.js
(() => {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // フラグで有効/無効を切替
  const DEBUG = !!window.PRISMCAT_DEBUG_ALBUM;
  if (!DEBUG) return;

  // GameSpec を index/phase のどちらからでも読めるように試行
  async function loadSpecSmart() {
    const tryPaths = ["./GameSpec.json", "../GameSpec.json"];
    for (const p of tryPaths) {
      try {
        const r = await fetch(p);
        if (r.ok) return { spec: await r.json(), base: p.startsWith("../") ? ".." : "." };
      } catch {}
    }
    throw new Error("GameSpec.json が見つかりません");
  }

  function ensureArray(v) { return Array.isArray(v) ? v : (v ? [v] : []); }

  function injectButton(onClick) {
    const btn = document.createElement("button");
    btn.textContent = "アルバム全開放（DEBUG）";
    btn.className = "btn small";
    btn.style.marginLeft = "8px";
    btn.addEventListener("click", onClick);

    const topbar =
      document.querySelector(".topbar") ||
      document.querySelector("header") ||
      document.body;

    const wrap = document.createElement("span");
    wrap.style.marginLeft = "auto";
    wrap.appendChild(btn);
    // 既存トップバーがあれば右側へ、無ければ右上固定
    if (topbar && topbar !== document.body) {
      topbar.appendChild(wrap);
    } else {
      btn.style.position = "fixed";
      btn.style.top = "12px";
      btn.style.right = "12px";
      document.body.appendChild(btn);
    }
  }

  ready(() => {
    injectButton(async () => {
      try {
        const { spec, base } = await loadSpecSmart();

        // clearedPhases を全フェーズに
        const allIds = (spec.phases || []).map(ph => ph.id);
        localStorage.setItem("clearedPhases", JSON.stringify(allIds));

        // 各フェーズの albumPhase_{id} を 1..8 で埋める
        const imgBase = (spec.assets?.imageBase || "assets/image").replace(/\/+$/, "");
        for (const ph of (spec.phases || [])) {
          const pattern = ph?.cards?.pattern || `phase${ph.id}card`;
          // 8枠に合わせ、1..8 を使う（存在する範囲でOK）
          const items = Array.from({ length: 8 }, (_, i) =>
            `${base}/${imgBase}/${pattern}${i + 1}.webp`
          );
          localStorage.setItem(`albumPhase_${ph.id}`, JSON.stringify(items));
        }

        alert("デバッグ：全アルバムを開放＆サンプルで充填しました。ページを再読み込みします。");
        location.reload();
      } catch (e) {
        console.error(e);
        alert("デバッグ開放に失敗しました。コンソールを確認してください。");
      }
    });
  });
})();
