// phases-row.js : Phase タイルの親に .phase-list を付与して横一列レイアウトを適用
(function () {
  const onReady = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  onReady(() => {
    // Phaseタイルっぽい要素を推定（画像＋「Phase」テキストを含むカード）
    const candidates = Array.from(document.querySelectorAll("a, div")).filter(el => {
      const txt = (el.textContent || "").trim();
      return /Phase\s*\d+/.test(txt) && el.querySelector("img");
    });
    if (candidates.length === 0) return;

    // 共通の親を見つけて .phase-list を付与
    // もっとも近い広いコンテナ（セクション/メイン）を探す
    let container = candidates[0].closest("#phases, .phases, main, section, #album, .content") || candidates[0].parentElement;
    if (!container) container = document.body;
    container.classList.add("phase-list");
  });
})();
