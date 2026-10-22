// Giant DEVORA word on the home hero: sized to span the screen, tilts in 3D
// toward the cursor, and lifts the letters closest to the pointer.
(function(){
  const word = document.getElementById('heroWord');
  if(!word) return;
  const wrap = word.parentElement;
  const letters = [...word.querySelectorAll('span')];
  letters.forEach((el, i) => el.style.setProperty('--i', i));

  // Scale the font so the word fills the available width exactly.
  function fit(){
    word.style.fontSize = '100px';
    const available = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
    // leave room for the extruded edge, which isn't part of the text box
    const size = 100 * available / (word.scrollWidth * 1.045);
    word.style.fontSize = Math.min(size, window.innerHeight * 0.5) + 'px';
  }
  fit();
  window.addEventListener('resize', fit);
  if(document.fonts) document.fonts.ready.then(fit);

  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(window.matchMedia('(hover: none)').matches) return;

  const MAX_TILT = 9;
  let frame = 0;

  function update(x, y){
    const rect = word.getBoundingClientRect();
    const nx = (x - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
    const ny = (y - (rect.top + rect.height / 2)) / (window.innerHeight / 2);
    word.style.setProperty('--ry', (nx * MAX_TILT).toFixed(2) + 'deg');
    word.style.setProperty('--rx', (-ny * MAX_TILT * 0.7).toFixed(2) + 'deg');

    // letters near the cursor come forward and rise
    const reach = rect.width / 4;
    letters.forEach(el => {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      const pull = Math.max(0, 1 - d / reach);
      el.style.setProperty('--z', (pull * 80).toFixed(1) + 'px');
      el.style.setProperty('--lift', (-pull * 0.06 * parseFloat(word.style.fontSize)).toFixed(1) + 'px');
      el.classList.toggle('is-near', pull > 0.55);
    });
  }

  function reset(){
    word.style.setProperty('--rx', '0deg');
    word.style.setProperty('--ry', '0deg');
    letters.forEach(el => {
      el.style.setProperty('--z', '0px');
      el.style.setProperty('--lift', '0px');
      el.classList.remove('is-near');
    });
  }

  const hero = word.closest('section');
  hero.addEventListener('pointermove', e => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => update(e.clientX, e.clientY));
  });
  hero.addEventListener('pointerleave', reset);
})();
