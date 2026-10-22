// About page team badges: each hangs from its lanyard and swings like a
// pendulum when the mouse sweeps across it, tilting in 3D toward the cursor.
(function(){
  const hangs = [...document.querySelectorAll('.badge-hang')];
  if(!hangs.length) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const STIFFNESS = 0.035, DAMPING = 0.93, MAX_ANGLE = 22;

  const state = hangs.map((el, i) => ({
    el,
    badge: el.querySelector('.badge'),
    angle: i % 2 ? -6 : 6, // start mid-swing so they settle in on load
    vel: 0,
    tiltX: 0, tiltY: 0, targetX: 0, targetY: 0,
    lastX: null
  }));

  let running = false;
  function loop(){
    let moving = false;
    state.forEach(s => {
      s.vel += -s.angle * STIFFNESS;
      s.vel *= DAMPING;
      s.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, s.angle + s.vel));
      s.tiltX += (s.targetX - s.tiltX) * 0.12;
      s.tiltY += (s.targetY - s.tiltY) * 0.12;
      s.el.style.transform = `rotate(${s.angle.toFixed(2)}deg)`;
      s.badge.style.transform = `perspective(900px) rotateX(${s.tiltX.toFixed(2)}deg) rotateY(${s.tiltY.toFixed(2)}deg)`;
      if(Math.abs(s.angle) > 0.05 || Math.abs(s.vel) > 0.05 ||
         Math.abs(s.targetX - s.tiltX) > 0.05 || Math.abs(s.targetY - s.tiltY) > 0.05) moving = true;
    });
    if(moving) requestAnimationFrame(loop);
    else running = false;
  }
  function kick(){
    if(!running){ running = true; requestAnimationFrame(loop); }
  }

  state.forEach(s => {
    s.badge.addEventListener('pointermove', e => {
      // horizontal mouse speed pushes the badge; position sets the tilt
      if(s.lastX !== null) s.vel += (e.clientX - s.lastX) * 0.06;
      s.lastX = e.clientX;
      const r = s.badge.getBoundingClientRect();
      s.targetY = ((e.clientX - r.left) / r.width - 0.5) * 24;
      s.targetX = (0.5 - (e.clientY - r.top) / r.height) * 16;
      kick();
    });
    s.badge.addEventListener('pointerleave', () => {
      s.lastX = null; s.targetX = 0; s.targetY = 0;
      kick();
    });
    s.badge.addEventListener('click', e => {
      if(e.target.closest('a')) return;
      s.vel += (Math.random() > 0.5 ? 1 : -1) * 4; // a tap sends it swinging
      kick();
    });
  });

  kick();
})();
