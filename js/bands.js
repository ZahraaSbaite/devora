// Palette bands stack as you scroll: each one sticks, and the next slides up
// over it. A band taller than the screen sticks by its bottom edge instead
// of its top, so all of its content is seen before it gets covered.
(function(){
  const bands = [...document.querySelectorAll('.band')];
  if(!bands.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function layout(){
    const vh = window.innerHeight;
    bands.forEach(b => { b.style.top = Math.min(0, vh - b.offsetHeight) + 'px'; });
    update();
  }

  let ticking = false;
  function update(){
    ticking = false;
    if(reduceMotion) return;
    const vh = window.innerHeight;
    bands.forEach((b, i) => {
      const next = bands[i + 1];
      // 0 until the next band starts to slide over, 1 once it reaches the top
      const cover = next && next.parentElement === b.parentElement
        ? Math.min(1, Math.max(0, 1 - next.getBoundingClientRect().top / vh))
        : 0;
      b.style.setProperty('--cover', cover.toFixed(3));
    });
  }
  function onScroll(){
    if(!ticking){ ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', layout);
  if(document.fonts) document.fonts.ready.then(layout);
  window.addEventListener('load', layout);
  // content loaded later (project cards) changes band heights
  if('ResizeObserver' in window) new ResizeObserver(layout).observe(document.body);
  layout();
})();
