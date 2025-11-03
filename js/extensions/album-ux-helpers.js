// album-ux-helpers.js — 最小安定版（表示固定のみ／監視・イベント一切なし）
(() => {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  ready(() => {
    const album = document.getElementById("album");
    if (!album) return;

    // アルバムを「一度だけ」表示固定（以後ノータッチ）
    album.hidden = false;
    album.classList.add("active");
    ["is-hidden","hidden","collapsed","closed","locked","invisible","d-none"]
      .forEach(c => album.classList.remove(c));
    // 念のため inline スタイルの隠し系を外す（1回だけ）
    ["display","visibility","opacity","height"].forEach(k => album.style.removeProperty(k));

    // 区切りUIを削除（演出矢印など）
    document.querySelectorAll(".section-divider, #scrollDownHint, .scroll-down-hint")
      .forEach(el => el.remove());
  });
})();
