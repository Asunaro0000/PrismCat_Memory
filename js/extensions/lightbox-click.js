// クリック時以外の close を無効化し、クリックしたときだけ閉じる
(function () {
  const onReady = (fn) =>
    (document.readyState === "loading")
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  onReady(() => {
    const lb = document.getElementById("lightbox");
    if (!lb) return;

    // 許可フラグ（クリック時のみ true）
    const ALLOW = Symbol("allowClose");
    lb[ALLOW] = false;

    // 既存の onclick（もし inline で設定されていても）を無効化
    lb.onclick = null;

    // この要素に対する classList.remove('open') をフック
    const origRemove = lb.classList.remove.bind(lb.classList);
    lb.classList.remove = function (...tokens) {
      // open を外そうとしている & クリックで許可していない → 無視
      if (tokens.includes("open") && !lb[ALLOW]) return;
      return origRemove(...tokens);
    };

    // どこをクリックしても閉じる（このときだけ許可）
    lb.addEventListener("click", () => {
      lb[ALLOW] = true;
      // rAF でレイアウト確定後に閉じる（競合回避）
      requestAnimationFrame(() => {
        try { lb.classList.remove("open"); } finally { lb[ALLOW] = false; }
      });
    });

    // タイマー系での close をさらに無効化（保険）
    const nativeSetTimeout = window.setTimeout;
    window.setTimeout = function (cb, ms, ...rest) {
      // ライトボックスを閉じそうなコールバックは握りつぶす
      try {
        const src = (typeof cb === "function" && cb.toString()) || "";
        const targetsLB = /lightbox/.test(src) && /classList\.remove\(['"]open['"]\)/.test(src);
        if (targetsLB) return 0; // ダミーID
      } catch (_) {}
      return nativeSetTimeout(cb, ms, ...rest);
    };
  });
})();
