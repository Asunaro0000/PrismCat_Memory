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
      1: "There is still no sound today. Only the cat-ear light clicks on. Not knowing anything feels a little like freedom.",
      2: "I rest both hands on the keys. A deep breath, then a chord. Clumsy, but this is the first bar of the first song.",
      3: "A 'Do Not Enter' sign lights up inside my chest. I'm scared. Still, I take a step.",
      4: "The flicker outside the window becomes a metronome. The noise starts to sound a little like a beat.",
      5: "A butterfly of light drifts up. I can’t catch it, but I think I see the shadow of a melody.",
      6: "There’s still no sound. The light is distant. Yet deep in the system, something has definitely begun to move.",
      7: "It isn’t working. I hug my knees and steady my breath. On the verge of tears, I still don’t power off.",
      8: "My fingertips touch the strings. Awkward noise. But a small beat is born in my palms."
    },
    2: {
      1: "Voices overlap in a sea of data. Even if it doesn’t come through perfectly, it matters that the sound tries to reach.",
      2: "We sit at the same desk, yet read different code. Still, the air in this room feels the same.",
      3: "Laughter mixes with synth noise. Sweet moments, by-products of effort.",
      4: "Clock hands cross the waveform. The misaligned beats are proof we’re still alive.",
      5: "You can’t run in front of a mic. Heartbeats blend with the click and turn into truth.",
      6: "Reach out and we can sync. Our rhythms differ, but the wish to overlap is the same.",
      7: "Blue and crimson—two selves meet. Not a collision, but the beginning of understanding.",
      8: "My breath aligns with the one beyond the mirror. The offset doesn’t vanish—it turns into harmony."
    },
    3: {
      1: "I begin to play in sync with the city’s morning. I leave today’s sound and tune for tomorrow.",
      2: "Different frequencies overlap. When blue and crimson melodies become a single record, my heart races.",
      3: "The sound spreads. When it stops being my world alone, I’m a little afraid—and happy.",
      4: "A teaching voice rings out. I can laugh at notes I can’t play yet. I think that’s my strength now.",
      5: "Stage light reflects. The phrase I practiced that day turns into today’s applause.",
      6: "The small us on the screen bounce. Recording is an extension of playfulness. Even smiles are valid data.",
      7: "I dance within the recording. I can redo it endlessly. That’s why I want to cherish this moment.",
      8: "Light cycles and my fingers don’t stop. Each strike of the keys makes my heart lighter."
    },
    4: {
      1: "The red alert still blinks. I don’t know how to stop it. Maybe it doesn’t have to stop.",
      2: "Notes reflect in broken glass. Only the aftertone of a shattered melody quietly resounds.",
      3: "Warning circles throb. The silence feels heavier than fear.",
      4: "Heartbeat overlaps the waveform. The line between breath and data blurs a little.",
      5: "The light dims. The sound is gone, yet somewhere only the rhythm remains.",
      6: "A shadow behind me touches gently. Without telling me anything, it stayed and listened to the noise.",
      7: "The chain isn’t heavy anymore. It didn’t come off or break; it just lost its meaning.",
      8: "A sunset room. Just before the reverb fades, music still lingers in the quiet."
    },
    5: {
      1: "My fingers move again. The ringing sound is like a prayer, searching for chords yet unnamed by the future.",
      2: "I stand before the piano. No more doubt. In the quiet, beginning and ending coexist.",
      3: "City lights blink like a score. My melody melts into the night and returns to the sky.",
      4: "Wings of light tremble. The sound played with someone slowly dilutes the shards of loneliness.",
      5: "Layered sounds fill the space. Music taught me how to cry and smile at once.",
      6: "Our gazes meet. Once more, we breathe together and play the notes that haven’t reached yet.",
      7: "We smile inside the screen. We came not to record, but to carve the next moment.",
      8: "The final note sinks quietly. Not an ending, but the announcement of another beginning."
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
    const pill = phase ? `<span class="cap-label">Phase ${phase}</span>` : "";
    const sub =
      !isMobile() && subtitle
        ? `<span class="cap-sub">${safe(subtitle)}</span>`
        : "";
    const sep = sub && body ? `<span class="cap-sep">—</span>` : "";

    // 省略処理（ellipsisFit）を削除し、全文をそのまま表示
    const content = safe(body);

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
        1: "It Begins in Silence",
        2: "Touching the Boundary",
        3: "The Recording Hand",
        4: "Room of Ripples",
        5: "Afterglow of Light"
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
