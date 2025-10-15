// album-caption.js：Lightbox + Caption（1行省略 / モバイル12px / Phaseピル）
// - 背景クリックで閉じる / 画像クリックでキャプション表示ON/OFF
// - 画像src → phaseXcardY から自動で Phase/Index 推定（data-* があれば優先）
// - CAPTIONS テーブルで本文を取得（無ければ alt / data-cap / 空文字）
//
// 置き場所: /js/extensions/album-caption.js

(function () {
  // ========= Ready =========
  const onReady = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  // ========= Captions =========
  // ※必要に応じて編集してください
  const CAPTIONS = {
    1: {
      1: "今日はまだ音がない。猫耳のライトだけが点いた。何も知らないのが、少し自由だ。",
      2: "鍵盤に両手を置く。深呼吸、そして和音。拙いけれど、ここが一曲目の最初の小節。",
      3: "胸の中に「立入禁止」の札が灯る。怖い。でも一歩、進む。",
      4: "窓の外の明滅がメトロノームになる。ノイズが、すこしだけビートに聞こえた。",
      5: "光の蝶がふわり。掴めないけれど、旋律の影が見えた気がする。",
      6: "まだ音はない。光も遠い。けれどシステムの奥で、何かが確かに動き出している。",
      7: "うまくいかない。膝を抱えて呼吸をそろえる。泣きそうなまま、電源は切らない。",
      8: "指先が弦に触れる。ぎこちないノイズ。でも手のひらに、小さな拍が生まれる。"
    },
    2: {
      1: "データの海で声が重なる。うまく伝わらなくても、届こうとする音があればいい。",
      2: "同じデスクに座っても、見ているコードは違う。けれど、この部屋の空気は一緒だ。",
      3: "笑い声とシンセのノイズが混ざる。甘い時間は、努力の副産物みたいなもの。",
      4: "時間の針と波形が交差する。拍のズレは、まだ私たちが生きてる証拠。",
      5: "マイクの前では逃げられない。心拍がクリックと混ざって、真実になる。",
      6: "手を伸ばせば同期できる。違うリズムでも、重なりたいと願う気持ちは同じ。",
      7: "青と紅、ふたつの私が交わる。衝突じゃなく、理解のはじまり。",
      8: "鏡越しのもう一人と呼吸が揃う。ズレは消えず、ハーモニーに変わった。"
    },
    3: {
      1: "街の朝と同じテンポで弾き始める。今日の音を残して、明日をチューニングする。",
      2: "異なる周波数が重なる。青と紅の旋律がひとつの記録になる瞬間、胸が高鳴る。",
      3: "音が広がる。自分だけの世界じゃなくなる瞬間、少し怖くて、でも嬉しい。",
      4: "教える声が響く。できない音も笑えるようになった。それが今の私の強さだと思う。",
      5: "ステージの光が反射する。あの日練習したフレーズが、今日の拍手に変わっていく。",
      6: "画面の中の小さな私たちが跳ねる。記録は遊び心の延長線。笑顔も立派なデータだ。",
      7: "記録の中の私が踊る。何度でもやり直せる。だからこそ、今の一瞬を大切にしたい。",
      8: "光の回路に囲まれて、指が止まらない。録音ボタンを押すたびに、心が少し軽くなる。"
    },
    4: {
      1: "赤いアラートがまだ瞬く。止め方は知らない。でも、止まらなくてもいい気がした。",
      2: "割れたガラスに音符が映る。壊れた旋律の余韻だけが、静かに響いている。",
      3: "警告の円が脈打つ。恐れよりも、静寂の方が重く感じた。",
      4: "心拍と波形が重なる。呼吸とデータの境目が、少しだけ曖昧になる。",
      5: "光が弱まる。音は消えたのに、どこかでリズムだけが残っている。",
      6: "背後の影がそっと触れる。何も教えないまま、ノイズを一緒に聴いてくれていた。",
      7: "鎖はもう重くない。外れたわけでも、切れたわけでもない。ただ、意味をなくした。",
      8: "夕焼けの部屋。残響が消える直前、静けさの中にまだ“音楽”がいた。"
    },
    5: {
      1: "再び指が動く。響く音は祈りのようで、まだ名もない未来のコードを探している。",
      2: "ピアノの前に立つ。もう迷いはない。静けさの中に、始まりと終わりが共にある。",
      3: "街の灯りが譜面のように瞬く。私の旋律は、夜に溶け、空へ還る。",
      4: "光の翼が揺れる。誰かと奏でる音が、孤独のかけらを少しずつ薄めていく。",
      5: "重ねた音が空間を満たす。泣きながら笑うことを、音楽が教えてくれた。",
      6: "仲間の視線が交わる。もう一度、息を合わせて、まだ届いていない音を鳴らす。",
      7: "スクリーンの中の私たちが微笑む。記録ではなく、続きの一瞬を刻みに来た。",
      8: "最後の音が静かに沈む。終わりではなく、また一つの始まりを告げていた。"
    }
  };

  // ========= Utilities =========
  const WIDTH_LIMIT = { desktop: 52, mobile: 38 }; // 全角相当の目安
  const isMobile = () => matchMedia("(max-width: 900px)").matches;
  const safe = (s) => String(s || "").replace(/[<>]/g, "");

  function jaVisualLen(s = "") {
    let w = 0;
    for (const ch of s) w += /[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1;
    return w;
  }
  function ellipsisFit(s = "", max = 48) {
    if (jaVisualLen(s) <= max) return s;
    let buf = "";
    for (const ch of s) {
      if (jaVisualLen(buf + ch + "…") > max) break;
      buf += ch;
    }
    return buf + "…";
  }

  // Phase ピル + 副題 + 本文
  function buildCaptionHTML({ phase, subtitle, body }) {
    const max = isMobile() ? WIDTH_LIMIT.mobile : WIDTH_LIMIT.desktop;
    const pill = phase ? `<span class="cap-label">Phase ${phase}</span>` : "";
    const sub =
      !isMobile() && subtitle
        ? `<span class="cap-sub">${safe(subtitle)}</span>`
        : "";
    const sep = sub && body ? `<span class="cap-sep">—</span>` : "";

    // モバイルは省略しない（そのまま全文）。PCのみ視覚幅に合わせて省略。
    const content = isMobile()
      ? safe(body)
      : ellipsisFit(
          safe(body),
          max - jaVisualLen(sub.replace(/<[^>]+>/g, "")) - 6
        );
    return `${pill}${sub}${sep}${content}`;
  }

  // src or data-* から Phase/Index を推定
  function derivePhaseIndex(img) {
    const ds = img?.dataset || {};
    let phase = Number(ds.phase || 0) || 0;
    let index = Number(ds.card || ds.index || 0) || 0;

    // e.g. phase3card7.webp
    const m = String(img.currentSrc || img.src || "").match(/phase(\d+)card(\d+)\.(webp|png|jpe?g|gif|avif)/i);
    if (m) {
      if (!phase) phase = Number(m[1]) || 0;
      if (!index) index = Number(m[2]) || 0;
    }
    return { phase, index };
  }

  // ========= DOM build =========
  onReady(() => {
    const album = document.querySelector("#album");
    if (!album) return;

    // Lightbox skeleton
    let lb = document.querySelector("#lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "lightbox";
      lb.innerHTML = `
        <div class="frame"><img alt=""></div>
        <div class="lb-caption" aria-live="polite"></div>
      `;
      document.body.appendChild(lb);
    }
    const frame = lb.querySelector(".frame");
    const imgEl = frame.querySelector("img");
    const caption = lb.querySelector(".lb-caption");

    // Inject style（後勝ち・一回だけ）
    if (!document.getElementById("lb-style-enhanced")) {
      const st = document.createElement("style");
      st.id = "lb-style-enhanced";
      st.textContent = `
      /* ===== Lightbox base ===== */
      #lightbox{
        position: fixed; inset: 0; display: none; place-items: center;
        background: rgba(0,0,0,.65); backdrop-filter: blur(6px);
        z-index: 9999; padding: 2vh;
      }
      #lightbox.open{ display: grid; }

      #lightbox .frame{
        position: relative;
        max-width: min(95vw, 1200px);
        max-height: min(90vh, 900px);
        display: flex; justify-content: center; align-items: center;
      }
      #lightbox .frame img{
        width: auto; max-width: 100%;
        height: auto; max-height: 100%;
        border-radius: 8px; object-fit: contain;
        box-shadow: 0 10px 40px rgba(0,0,0,.5);
        cursor: pointer;
      }

      /* ===== Caption (1行固定＋省略) ===== */
      #lightbox .lb-caption{
        position: fixed; left: 50%; bottom: 2vh; transform: translateX(-50%);
        max-width: min(92vw, 1100px);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        background: rgba(0,0,0,.7); color: #fff;
        font-size: 14px; line-height: 1.6;
        padding: 10px 14px; border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,.25);
        text-align: center; transition: opacity .25s ease;
      }

      /* Phaseピル & 区切り */
      #lightbox .lb-caption .cap-label{
        display:inline-block; margin-right:.5em; padding:.05em .6em;
        font-weight:700; font-size:.9em; letter-spacing:.02em;
        color:#fff; background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.18); border-radius:999px;
      }
      #lightbox .lb-caption .cap-sub{ opacity:.85; margin-right:.4em; }
      #lightbox .lb-caption .cap-sep{ opacity:.6; margin:0 .5em; }

      /* === Mobile-only === */
      @media (max-width: 900px){
        #lightbox .lb-caption{ font-size:12px; }
        #lightbox .lb-caption .cap-sub{ display:none; } /* モバイルは副題を省略 */
      }`;
      document.head.appendChild(st);
    }

    // ========= Open from album =========
    album.addEventListener("click", (ev) => {
      const img = ev.target.closest("img");
      if (!img) return;

      // 画像
      imgEl.src = img.currentSrc || img.src;

      // キャプション構築
      const { phase, index } = derivePhaseIndex(img);
      // 例：好きな文言に書き換えてください
      const PHASE_SUBTITLES = {
        1: "無音からはじまる",
        2: "境界に触れる",
        3: "記録する手",
        4: "揺らぎの部屋",
        5: "光の余韻"
      };
   

      // 新：サムネ指定 > フェーズ既定 > #album に置いた data-sub{n} > なし
      const albumEl = document.querySelector('#album');
      const subtitle =
        img.dataset.sub ??
        PHASE_SUBTITLES[phase] ??
        (albumEl?.dataset?.[`sub${phase}`] || ""); // 例: <div id="album" data-sub1="無音からはじまる">

      const fallback = img.alt || img.dataset.cap || "";
      const body = (CAPTIONS[phase] && CAPTIONS[phase][index]) || fallback || "";
      const html = buildCaptionHTML({ phase, subtitle, body });

      caption.innerHTML = html;
      caption.style.opacity = 1;
      caption.style.display = "block";

      lb.classList.add("open");
    });

    // ========= Close / Toggle =========
    // 背景クリックで閉じる
    lb.addEventListener("click", (e) => {
      if (e.target === lb) lb.classList.remove("open");
    });
    // Esc でも閉じる
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.classList.contains("open")) lb.classList.remove("open");
    });
    // 画像クリックでキャプション表示ON/OFF
    imgEl.addEventListener("click", (e) => {
      e.stopPropagation();
      caption.style.opacity = caption.style.opacity === "0" ? "1" : "0";
    });

    // 画像ロード時に微妙な幅変化へ追従（見た目のブレ抑制）
    imgEl.addEventListener("load", () => {
      // 将来「画像幅に合わせてcap最大幅を縮める」等を入れる場合はここに追記
    }, { once:false });
  });

  // デバッグ/他拡張から参照したい時用
  window.CAPTION_MAP = CAPTIONS;
})();

// 向きが変わったらページをリロード
(function autoRefreshOnOrientation(){
  const mm = window.matchMedia('(orientation: landscape)');
  let last = mm.matches ? 'landscape' : 'portrait';
  let timer;

  function reloadOnce(){
    const now = mm.matches ? 'landscape' : 'portrait';
    if (now === last) return;        // 同一イベントの重複発火を抑制
    last = now;
    clearTimeout(timer);
    timer = setTimeout(() => { location.reload(); }, 120); // 少し待ってから
  }

  // 新旧ブラウザ両対応
  if (mm.addEventListener) mm.addEventListener('change', reloadOnce);
  else                     mm.addListener(reloadOnce);
  window.addEventListener('orientationchange', reloadOnce, {passive:true});
})();
