// Site-wide pointer effects: a soft glow that follows the cursor, and buttons
// that lean toward it. Skipped on touch screens and for reduced motion.
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(window.matchMedia('(hover: none)').matches) return;

  // ---- cursor glow ----
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);

  let gx = -500, gy = -500, tx = gx, ty = gy, glowRunning = false;
  function moveGlow(){
    gx += (tx - gx) * 0.18;
    gy += (ty - gy) * 0.18;
    glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
    if(Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) requestAnimationFrame(moveGlow);
    else glowRunning = false;
  }
  window.addEventListener('pointermove', e => {
    tx = e.clientX; ty = e.clientY;
    glow.classList.add('is-on');
    if(!glowRunning){ glowRunning = true; requestAnimationFrame(moveGlow); }
  });
  document.addEventListener('pointerleave', () => glow.classList.remove('is-on'));

  // ---- magnetic buttons ----
  const STRENGTH = 0.28;
  document.querySelectorAll('.btn-primary, .btn-secondary, .nav-cta').forEach(btn => {
    btn.classList.add('magnetic');
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * STRENGTH;
      const y = (e.clientY - r.top - r.height / 2) * STRENGTH;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
})();
