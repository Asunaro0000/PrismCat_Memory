// album-ingest-guard.js — 初回ロードの誤取り込みを全面ブロック＋多重発火の去重
(() => {
  // 1) 初回はロック：ユーザーの明示的ジェスチャーでだけ解除
  let unlocked = false;
  const unlock = () => { unlocked = true; cleanupUnlockers(); };
  const unlockers = [
    ["pointerdown", true],
    ["keydown",     false],
  ];
  function cleanupUnlockers() {
    for (const [ev, cap] of unlockers) window.removeEventListener(ev, unlock, { capture: cap });
  }
  for (const [ev, cap] of unlockers) window.addEventListener(ev, unlock, { capture: cap, once: true, passive: true });

  // 2) アルバム要素
  const onReady = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  onReady(() => {
    const album = document.getElementById("album");
    if (!album) return;

    // 3) “phase系のサムネ”を識別するヒューリスティック
    //   - data-phase-thumb で明示 or 画像srcが /phases/ や /phase\d+/ を含むもの
    //   - 必要ならここを調整
    const PHASE_RE = /(?:\/|^)(phases?\/|phase\d+)[^/]*\.(?:png|jpg|jpeg|webp|avif)$/i;
    const isPhaseThumbNode = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      if (node.dataset && (node.dataset.phaseThumb === "true" || node.dataset.phase === "thumb")) return true;
      const img = node.matches?.("img, picture, .thumb, .album-item img")
        ? node
        : node.querySelector?.("img, picture, .thumb img, .album-item img");
      if (!img) return false;
      // <picture>対応
      let src = "";
      if (img.tagName === "PICTURE") {
        const s = img.querySelector("source[srcset]"); src = s ? s.getAttribute("srcset") || "" : "";
      } else {
        src = img.getAttribute?.("src") || "";
      }
      return PHASE_RE.test(src);
    };

    // 4) 解除前は“アルバム追加”を全面拒否（追加されても即取り除く）
    const removedCache = new WeakSet(); // 無限ループ防止
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type !== "childList") continue;

        // 追加ノードをチェック
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;

          // 解除前：phaseっぽい追加は即除去
          if (!unlocked && (n === album || album.contains(n))) {
            const target = n === album ? null : (album.contains(n) ? n : null);
            if (target && !removedCache.has(target) && isPhaseThumbNode(target)) {
              removedCache.add(target);
              try { target.remove(); } catch {}
              return;
            }
          }
        });
      }
    });
    mo.observe(album, { childList: true, subtree: true });

    // 5) 解除後は“短時間の多重追加”を去重（同一srcは間引く）
    const seen = new Map(); // src -> lastTime
    const DEDUP_MS = 400;
    const moDedup = new MutationObserver((list) => {
      if (!unlocked) return; // ロック中は別のMOで対処済み
      const now = Date.now();
      for (const m of list) {
        if (m.type !== "childList") continue;
        m.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement)) return;
          if (!album.contains(n)) return;

          // 画像srcを抽出
          const img = n.matches?.("img") ? n : n.querySelector?.("img");
          if (!img) return;
          const src = img.getAttribute("src") || "";
          if (!src) return;

          const last = seen.get(src) || 0;
          if (now - last < DEDUP_MS) {
            // 直前にも同じsrcが来てる → 多重発火とみなして捨てる
            try { n.remove(); } catch {}
          } else {
            seen.set(src, now);
          }
        });
      }
    });
    moDedup.observe(album, { childList: true, subtree: true });

    // 6) ロード直後に一度だけ“既に入ってしまっているphaseサムネ”を掃除
    requestAnimationFrame(() => {
      if (unlocked) return; // 既に解錠されていれば不要
      [...album.children].forEach((child) => {
        if (isPhaseThumbNode(child)) {
          try { child.remove(); } catch {}
        }
      });
    });

    // 7) デバッグ用（必要ならコメントアウト）
    // window.__albumGuard = { unlock: () => { unlocked = true; }, PHASE_RE };
  });
})();
