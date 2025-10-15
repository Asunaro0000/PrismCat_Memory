// bg-video-auto.js — MP4専用版（webm無し）
// GameSpecの background 名から同名の .mp4 を背景動画として自動再生
(function () {
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once: true })
      : fn();

  const isPhasePage = /\/phases\/phase\d+\.html$/i.test(location.pathname);
  const prefix = location.pathname.includes("/phases/") ? "../" : "./";

  async function loadSpec() {
    const r = await fetch(prefix + "GameSpec.json");
    if (!r.ok) throw new Error("GameSpec.json not found");
    return r.json();
  }
  function derivePhaseId() {
    const m = location.pathname.toLowerCase().match(/phase(\d+)\.html$/);
    return m ? Number(m[1]) : null;
  }
  const v = document.getElementById('bgv');
  document.addEventListener('visibilitychange', () => {
    if (!v) return;
    if (document.hidden) v.pause(); else v.play().catch(()=>{});
  });
  ready(async () => {
    if (!isPhasePage) return;

    const bgFx = document.getElementById("bgFx");
    if (!bgFx) return;

    try {
      const spec = await loadSpec();
      const pid = derivePhaseId();
      const ph = (spec?.phases || []).find((p) => Number(p.id) === pid);
      if (!ph?.bg) return;

      // "phase1background.webp" -> "phase1background"
      const stem = ph.bg.replace(/\.(webp|png|jpe?g|avif)$/i, "");
      const baseDir = spec.assets?.bgBase || "assets/background";
      const mp4 = `${prefix}${baseDir}/${stem}.mp4`;

      // 既存のvideoを掃除
      const old = bgFx.querySelector("#bgv");
      if (old) old.remove();

      // video作成（属性は先に付ける：iOS安定化）
      const v = document.createElement("video");
      v.id = "bgv";
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute("muted", "");
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.loop = true;
      v.preload = "auto";
      Object.assign(v.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        zIndex: "-1",
        pointerEvents: "none",
      });

      // MP4だけを渡す
      const s = document.createElement("source");
      s.src = mp4;
      s.type = "video/mp4";
      v.appendChild(s);

      // 背景画像はオフ
      bgFx.style.backgroundImage = "none";
      bgFx.appendChild(v);

      // 再生トライ。失敗時は初回タップで再試行（無音のまま）
      v.play().catch(() => {
        const once = () => {
          v.muted = true;
          v.play().catch(() => {});
          window.removeEventListener("pointerdown", once, { once: true });
        };
        window.addEventListener("pointerdown", once, { once: true });
      });
    } catch {
      // 失敗時は静止背景のまま
    }
  });
})();
