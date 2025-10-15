/**
 * album-store-listener.js (single-listener / normalized)
 * -----------------------------------------------------
 * 目的:
 *  - pair マッチ時に画像URLを localStorage へ保存
 *  - 絶対URL/相対URL の混在を「./assets/...」に正規化して一意判定
 *  - 既存の二重保存データを自動マイグレーションで重複除去
 *
 * 期待するイベント:
 *  window.dispatchEvent(new CustomEvent('prismcat:pair-match', {
 *    detail: { phase: <1..N>, src: <img.src or url string> }
 *  }))
 *
 * データ構造:
 *  localStorage["albumPhase_<phase>"] = JSON.stringify(Array<string>);
 *  例: ["./assets/album/p01/a.webp", "./assets/album/p01/b.webp", ...]
 *
 * 使い方:
 *  - このファイルを読み込むだけ（IIFEで自己初期化）
 *  - window.AlbumStore から動作確認用ユーティリティも利用可
 */

(function () {
  // 多重初期化ガード
  if (window.__AlbumStoreInit) return;
  window.__AlbumStoreInit = true;

  // ====== 設定 ======
  const MAX_PER_PHASE = 12;         // フェーズごとの最大保存数
  const KEY = (p) => `albumPhase_${p}`;
  const PHASE_MIN = 1;
  const PHASE_MAX = 8;              // 必要に応じて増減
  const DEBUG = !!window.DEBUG_ALBUM;

  // ====== 小物 ======
  const log  = (...a) => DEBUG && console.log('[AlbumStore]', ...a);
  const warn = (...a) => DEBUG && console.warn('[AlbumStore]', ...a);

  // URL → "./assets/..." へ統一
  function toRelative(input) {
    const s = String(input || '');
    if (!s) return '';
    // 保存対象外
    if (s.startsWith('blob:') || s.startsWith('data:')) return '';

    try {
      // baseURI を基準に URL 化して path を取り出す
      const u = new URL(s, document.baseURI);
      let p = u.pathname.replace(/\/+/g, '/'); // 冗長スラッシュ除去

      // `/.../assets/...` を検出して "./assets/..." へ
      const m = p.match(/\/assets\/.+/);
      if (m) return '.' + m[0];

      // 既に相対パスならそのまま正規化
      if (/^\.*\/assets\//.test(s)) {
        const i = s.indexOf('/assets/');
        return '.' + s.slice(i);
      }

      // どうしても assets が見つからなければ、元の文字列を返す（が、重複判定は弱くなる）
      return s;
    } catch {
      // URL 化に失敗 → 最後の砦で相対系を拾う
      if (/^\.*\/assets\//.test(s)) {
        const i = s.indexOf('/assets/');
        return '.' + s.slice(i);
      }
      return s;
    }
  }

  const safeParse = (json) => {
    try {
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  };

  const readPhase = (phase) => safeParse(localStorage.getItem(KEY(phase)) || '[]');

  const writePhase = (phase, arr) => {
    try {
      localStorage.setItem(KEY(phase), JSON.stringify(arr));
      return true;
    } catch (e) {
      warn('write failed; retry later', e);
      return false;
    }
  };

  const dedup = (arr) => {
    const out = [];
    const seen = new Set();
    for (const s of arr) {
      const t = toRelative(s);
      if (!t) continue;
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
      if (out.length >= MAX_PER_PHASE) break;
    }
    return out;
  };

  // ====== 既存データのクリーンアップ（自動一度だけ） ======
  (function migrateOnce () {
    try {
      if (localStorage.getItem('__albumStoreMigrated_v2')) {
        log('migration: already done');
        return;
      }
      for (let p = PHASE_MIN; p <= PHASE_MAX; p++) {
        const cur = readPhase(p);
        if (!cur.length) continue;
        const cleaned = dedup(cur);
        writePhase(p, cleaned);
        log('migration: fixed', KEY(p), '->', cleaned.length);
      }
      localStorage.setItem('__albumStoreMigrated_v2', '1');
    } catch (e) {
      warn('migration error', e);
    }
  })();

  // ====== キュー & フラッシュ ======
  const Q = [];
  let busy = false;

  function enqueue(phase, src) {
    phase = Number(phase || 0);
    src   = String(src || '');
    if (!phase || !src) return;
    Q.push({ phase, src });

    if (window.requestIdleCallback) {
      requestIdleCallback(flush, { timeout: 200 });
    } else {
      setTimeout(flush, 0);
    }
  }

  async function flush() {
    if (busy) return;
    busy = true;

    while (Q.length) {
      const { phase, src } = Q.shift();

      // 正規化（ここで絶対/相対を吸収）
      const rel = toRelative(src);
      if (!rel) continue;

      // 読み込み → 追加 → 重複排除 → 書き込み
      const cur = readPhase(phase);
      const next = dedup([...cur, rel]);

      // 変化がなければスキップ
      if (next.length === cur.length) {
        log('skip duplicate', phase, rel);
        continue;
      }

      // 書き込み。失敗したら後で再試行
      if (!writePhase(phase, next)) {
        Q.unshift({ phase, src });
        await new Promise(r => setTimeout(r, 50));
        break;
      }

      log('saved', KEY(phase), rel, `(${next.length}/${MAX_PER_PHASE})`);
    }

    busy = false;
  }

  // ====== イベント購読 ======
  window.addEventListener('prismcat:pair-match', (ev) => {
    const d = ev && ev.detail || {};
    enqueue(d.phase, d.src);
  }, { passive: true });

  // タブ復帰・初回描画での取りこぼし対策
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });
  window.addEventListener('pageshow', flush);

  // ====== デバッグ/ユーティリティ ======
  window.AlbumStore = {
    read: (p) => readPhase(p),
    write: (p, arr) => writePhase(p, dedup(arr || [])),
    clear: (p) => localStorage.removeItem(KEY(p)),
    dump: () => {
      const out = {};
      for (let p = PHASE_MIN; p <= PHASE_MAX; p++) out[KEY(p)] = readPhase(p);
      return out;
    },
    _toRelative: toRelative,
    _flush: flush,
  };

  log('initialized');
})();
