/* ==========================================================
   phase-intro.js  —  最小改訂版（チラつき防止＋1行固定）
   変更点だけ要約：
   - 黒幕テキストを生成した直後は不可視＆折り返し禁止
   - Webフォント読み込み後に幅を測って必要時のみ縮小(scale)
   - その後に可視化 → 「二行→一行」の瞬間表示を根絶
   - 既存のタイミング（退場/ESCスキップ/クラス付与）は維持
========================================================== */
(() => {
  // 二重初期化ガード
  if (window.__phaseIntroInitialized__) return;
  window.__phaseIntroInitialized__ = true;

  // <head>先頭で preload を付け忘れていても安全側に
  if (!document.documentElement.classList.contains('preload')) {
    document.documentElement.classList.add('preload');
  }

  document.addEventListener('DOMContentLoaded', () => {
    /* ---------- 文言（必要に応じて編集） ---------- */
    const INTRO_TEXTS = {
      1: '無音からはじまる — 静寂の中で、小さな拍が生まれる。',
      2: '境界に触れる — 光と声が交わり、世界がかたちを持ち始める。',
      3: '記録する手 — 指先の鼓動が、記憶を音に変えていく。',
      4: '揺らぎの部屋 — ノイズの奥に、静けさが灯る。',
      5: '光の余韻 — 終わりの音が、次の始まりを照らしていた。'
    };

    /* ---------- フェーズID推定 (phaseX.html) ---------- */
    let PHASE_ID = 1;
    const m = location.pathname.match(/phase(\d+)\.html/i);
    if (m) PHASE_ID = Number(m[1]) || 1;

    /* ---------- bodyに .phase-X を付与（黒幕上テキストに割当） ---------- */
    document.body.className = document.body.className
      .split(/\s+/).filter(c => !/^phase-\d$/.test(c)).join(' ');
    document.body.classList.add(`phase-${PHASE_ID}`);

    /* ---------- アニメ長に合わせた表示時間（＋余韻200ms） ---------- */
    const DURATIONS_MS = { 1: 3600, 2: 3800, 3: 4000, 4: 3800, 5: 4200 };
    const SHOW_MS      = (DURATIONS_MS[PHASE_ID] || 3000) + 200;
    const FADE_OUT_MS  = 900; // CSSの .intro-cover { transition: opacity 900ms } と揃える

    /* ---------- 盤面は開始時に隠す ---------- */
    document.body.classList.add('prelude');

    /* ---------- 黒幕カバー生成（即黒・最前面） ---------- */
    const cover = document.createElement('div');
    cover.id = 'introCover';
    cover.className = 'intro-cover'; // CSS側で「退場はふわっと」
    cover.setAttribute('aria-hidden', 'true');

    // 黒幕上のテキスト要素（ここにだけ表示する）
    const line = document.createElement('div');
    line.className = 'line';
    line.textContent = INTRO_TEXTS[PHASE_ID] || '';

    // ★ 追加：最初から1行固定＆不可視（チラ見え防止）
    Object.assign(line.style, {
      whiteSpace: 'nowrap',
      textWrap: 'nowrap',
      wordBreak: 'keep-all',
      visibility: 'hidden',
      transformOrigin: 'center',
      willChange: 'transform'
    });

    cover.appendChild(line);

    // DOMに挿入（body直下の先頭：スタッキングの影響を受けにくい）
    document.body.insertBefore(cover, document.body.firstChild);

    // 実カバーが載ったのでプリロード黒を解除（透け無しで切替）
    document.documentElement.classList.remove('preload');

    /* ---------- ★ 追加：フォント待ち → 幅計測 → 必要なら縮小 → 表示 ---------- */
    const waitFonts = () => {
      try { return document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(); }
      catch { return Promise.resolve(); }
    };

    // 古い環境でも確実に表示させるフェイルセーフ（0.8sで強制表示）
    const failsafeId = setTimeout(() => { line.style.visibility = 'visible'; }, 800);

    waitFonts().finally(() => {
      clearTimeout(failsafeId);

      // はみ出す場合だけ縮小（viewportの92%以内）
      const vw   = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const maxW = vw * 0.92;

      line.style.transform = 'none';
      void line.offsetWidth;               // reflow
      const w = line.scrollWidth;

      if (w > 0 && w > maxW) {
        const s = Math.max(0.6, maxW / w); // 極端に小さくならないよう下限
        line.style.transform = `scale(${s})`;
      }

      // ここで初めて可視化（“二行→一行”の瞬間表示を根絶）
      line.style.visibility = 'visible';
    });

    /* ---------- アニメ終了に合わせて“ふわっと退場” ---------- */
    const hideAt   = SHOW_MS;
    const removeAt = SHOW_MS + FADE_OUT_MS;

    // A) 規定時間で退場
    const byTimeout = setTimeout(() => {
      cover.classList.add('hide');                 // opacity: 0 (fade-out)
      document.body.classList.remove('prelude');   // 盤面を見せる
      document.body.classList.add('play');
    }, hideAt);

    // B) デバッグ用：Escでスキップ
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      clearTimeout(byTimeout);
      cover.classList.add('hide');
      document.body.classList.remove('prelude');
      document.body.classList.add('play');
      // 早めに削除
      setTimeout(() => { if (cover.parentNode) cover.remove(); }, FADE_OUT_MS);
      window.removeEventListener('keydown', onKey);
    };
    window.addEventListener('keydown', onKey);

    // 完全に透明になったらDOMから除去
    setTimeout(() => {
      if (cover.parentNode) cover.remove();
      window.removeEventListener('keydown', onKey);
    }, removeAt);

    /* ---------- 重要：#introText は触らない ----------
       これにより、黒幕退場後の二度目の表示は発生しません。
       （フェーズ別アニメは CSS の
        body.phase-X .intro-cover .line { animation: ... } で適用）
    ---------------------------------------------------- */
  });
})();
