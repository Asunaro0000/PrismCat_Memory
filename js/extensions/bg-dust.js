// bg-dust.js — 極小パーティクルをゆっくり漂わせる（1回生成）
(function(){
  const ready = (fn)=>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn, { once:true })
      : fn();

  ready(()=>{
    if(document.getElementById('bgDust')) return; // 重複生成防止
    const dust = document.createElement('div');
    dust.id = 'bgDust';
    Object.assign(dust.style, { position:'fixed', inset:'0', zIndex:'-1', pointerEvents:'none' });
    document.body.appendChild(dust);

    const N = 18; // 粒の数（増やし過ぎない）
    for(let i=0;i<N;i++){
      const d = document.createElement('div');
      Object.assign(d.style, {
        position:'absolute', width:'4px', height:'4px', borderRadius:'50%',
        background:'rgba(255,255,255,.22)', filter:'blur(0.5px)',
        opacity:'.65', willChange:'transform, opacity'
      });
      // ランダム軌跡（斜めに流れる）
      const x0 = Math.random()*100, y0 = Math.random()*100;
      const x1 = x0 + (Math.random()*12 - 6);
      const y1 = y0 + (Math.random()*18 + 12);
      const dur = 28 + Math.random()*8;
      const delay = -Math.random()*20;

      d.animate([
        { transform:`translate3d(${x0}vw, ${y0}vh, 0)`, opacity:0.0 },
        { transform:`translate3d(${(x0+x1)/2}vw, ${(y0+y1)/2}vh, 0)`, opacity:0.45 },
        { transform:`translate3d(${x1}vw, ${y1}vh, 0)`, opacity:0.0 }
      ], { duration: dur*1000, delay: delay*1000, iterations: Infinity, easing:'linear' });

      dust.appendChild(d);
    }
  });
})();
