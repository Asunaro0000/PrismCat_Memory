// 背景 <video> のループを強制安定化（iOS/Safari/短尺/ネットワーク待ち 全部面倒見ます）
(function(){
  const ready = (fn)=> document.readyState==="loading"
    ? document.addEventListener("DOMContentLoaded", fn, { once:true }) : fn();

  function clamp(n, a=0, b=1){ return Math.max(a, Math.min(b, n)); }

  function armLoop(video){
    if (!video) return;

    // 自動再生・ループの必須属性（iOS対策）
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');
    video.controls = false;
    video.preload = 'auto';
    video.style.pointerEvents = 'none';

    // まず再生（失敗は無視）
    video.play().catch(()=>{});

    // 終端で必ず巻き戻す + 黒フラ防止（終端直前に先回り）
    let dur = 0;
    const EPS = 0.04; // 40ms 手前でリワインド
    video.addEventListener('loadedmetadata', ()=>{ dur = video.duration || 0; }, { once:true });
    video.addEventListener('timeupdate', ()=>{
      if (!dur) return;
      if (video.currentTime > dur - EPS) {
        try { video.currentTime = 0.001; } catch {}
      }
    });
    video.addEventListener('ended', ()=>{
      try { video.currentTime = 0.001; } catch {}
      video.play().catch(()=>{});
    });

    // ネットワーク待ち・一時停止などで止まったら即再開
    ['waiting','stalled','suspend','pause','emptied','abort','error'].forEach(ev=>{
      video.addEventListener(ev, ()=> video.play().catch(()=>{}));
    });

    // “完全に固まる” ケースへ watchdog（超軽量）
    // 100msごとに currentTime を監視。0.5秒以上増えなければキック。
    let lastT = 0, idle = 0;
    setInterval(()=>{
      const t = video.currentTime || 0;
      if (Math.abs(t - lastT) < 0.001) {
        if (++idle >= 5) { // ≒500ms 停滞
          try {
            const nearEnd = dur && t > dur - EPS;
            video.currentTime = nearEnd ? 0.001 : clamp(t, 0.001, Math.max(0.001, dur-0.001));
          } catch {}
          video.play().catch(()=>{});
          idle = 0;
        }
      } else {
        idle = 0;
      }
      lastT = t;
    }, 100);

    // タブ復帰で再開（モバイル対策）
    document.addEventListener('visibilitychange', ()=>{
      if (!document.hidden) video.play().catch(()=>{});
    });
  }

  ready(()=>{
    const bg = document.getElementById('bgFx');
    if (!bg) return;

    // 既に <video> があるなら即武装
    let v = bg.querySelector('video');
    if (v) { armLoop(v); return; }

    // 後から挿入される場合に備えて監視
    const obs = new MutationObserver(()=>{
      v = bg.querySelector('video');
      if (v) { armLoop(v); obs.disconnect(); }
    });
    obs.observe(bg, { childList:true, subtree:true });
    setTimeout(()=> obs.disconnect(), 8000); // 長期監視は不要
  });
})();
