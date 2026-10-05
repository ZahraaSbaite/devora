(function(){
  const counters = document.querySelectorAll('[data-count-to]');
  if(!counters.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate(el){
    const to = parseFloat(el.dataset.countTo);
    const suffix = el.dataset.countSuffix || '';
    if(reduceMotion){
      el.textContent = to + suffix;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    function tick(now){
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(to * eased);
      el.textContent = value + suffix;
      if(progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if(!('IntersectionObserver' in window)){
    counters.forEach(animate);
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        animate(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => io.observe(el));
})();
