(() => {
  if (window.PhaseEnd3s) return;

  const defaults = {
    delayMs: 3000,
    fadeMs: 1200,
    message: "アルバムが開放されました。",
    hint: "クリックで戻る",
    albumUrl: "../index.html"
  };

  function fadeOutBGM(ms){
    const tag=document.querySelector("audio#bgm, audio[data-bgm], audio.bgm");
    if(tag && !tag.paused){
      const start=tag.volume??1,t0=performance.now();
      const tick=t=>{const k=Math.min(1,(t-t0)/ms);tag.volume=Math.max(0,start*(1-k));
        if(k<1) requestAnimationFrame(tick); else {try{tag.pause()}catch{}}};
      requestAnimationFrame(tick);return;
    }
    if(window.__bgm && typeof window.__bgm.fade==="function"){
      try{const v=typeof window.__bgm.volume==="function"?window.__bgm.volume():1;
        window.__bgm.fade(v,0,ms);
        setTimeout(()=>{if(typeof window.__bgm.pause==="function") window.__bgm.pause()},ms+50);
      }catch{}
    }
  }

  function createOverlay(msg,hint){
    const el=document.createElement("div");
    el.className="phase-end3s";
    if(msg||hint){
      el.innerHTML=`<div class="panel">
        ${msg?`<div class="message">${msg}</div>`:""}
        ${hint?`<div class="hint">${hint}</div>`:""}
      </div>`;
    }
    document.body.appendChild(el);
    return el;
  }

  function wireExit(el,href){
    el.addEventListener("click",()=>{document.body.classList.add("pe3s-fadeout");
      setTimeout(()=>{location.href=href},700)}, {once:true});
  }

  window.PhaseEnd3s = {
    config: { ...defaults },
    show(phase=1){
      if (window.__phaseEndHandled) return;
      window.__phaseEndHandled = true;

      const cfg={...defaults,...(window.PhaseEnd3s?.config||{})};
      fadeOutBGM(cfg.fadeMs);

      const href=`${cfg.albumUrl}#album-phase${Number(phase)||1}`;
      const overlay=createOverlay(cfg.message,cfg.hint);
      wireExit(overlay, href);

      setTimeout(()=>{ requestAnimationFrame(()=>overlay.classList.add("active")) }, cfg.delayMs);
    }
  };

  window.addEventListener("prismcat:phase-complete", (ev)=>{
    const phase = Number(ev?.detail?.phase) || 1;
    window.PhaseEnd3s.show(phase);
  });

  console.log("[PhaseEnd3s] ready (3s delay overlay)");
})();
