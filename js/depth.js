// Scroll-driven effects shared by every page: a reading-progress bar, the
// process timeline filling in as it scrolls past, and the home marquee
// leaning with scroll speed.
(function(){
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  const timeline = document.querySelector('.timeline');
  const marquee = document.querySelector('.marquee-track');

  let lastY = window.scrollY, skew = 0, ticking = false;

  function update(){
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    if(timeline){
      // 0 when the timeline enters the bottom of the screen, 1 at mid-screen
      const r = timeline.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.5 + r.height)));
      timeline.style.setProperty('--progress', p.toFixed(3));
      const steps = timeline.querySelectorAll('.timeline-step');
      steps.forEach((step, i) => step.classList.toggle('is-lit', p >= (i + 0.5) / steps.length));
    }

    if(marquee && !reduceMotion){
      const v = Math.max(-1, Math.min(1, (y - lastY) / 40));
      skew += (v * -8 - skew) * 0.2;
      marquee.style.setProperty('--skew', skew.toFixed(2) + 'deg');
      if(Math.abs(skew) > 0.05) requestTick();
    }
    lastY = y;
  }

  function requestTick(){
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', requestTick, { passive:true });
  window.addEventListener('resize', requestTick);
  update();
})();
