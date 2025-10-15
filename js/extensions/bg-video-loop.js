// /js/extensions/bg-video-loop.js — 最小・安定ループ版
(function(){
  const ready = (fn)=> document.readyState==="loading"
    ? document.addEventListener("DOMContentLoaded", fn, { once:true }) : fn();

  ready(()=>{
    const bg = document.getElementById('bgFx');
    if (!bg) return;
    const v  = bg.querySelector('video');
    if (!v) return;

    // ループ・自動再生の必須属性（iOS対策込み）
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('playsinline',''); v.setAttribute('webkit-playsinline','');
    v.controls = false; v.preload = 'auto';
    v.style.pointerEvents = 'none';

    // まず再生（失敗は無視）
    v.play().catch(()=>{});

    // 終端直前で先回りリワインド（黒フラ防止）
    let dur = 0, EPS = 0.04;              // 40ms手前で頭に戻す
    v.addEventListener('loadedmetadata', ()=> dur = v.duration || 0, { once:true });
    v.addEventListener('timeupdate', ()=>{
      if (dur && v.currentTime > dur - EPS) v.currentTime = 0.001;
    });

    // 念のため ended でも復帰
    v.addEventListener('ended', ()=>{
      try { v.currentTime = 0.001; } catch {}
      v.play().catch(()=>{});
    });

    // ネットワーク待ち等で止まったら即再生
    ['waiting','stalled','suspend','pause'].forEach(ev=>{
      v.addEventListener(ev, ()=> v.play().catch(()=>{}));
    });
  });
})();
