// 3D tilt toward the cursor for every .tilt-card. Delegated from the document
// so cards added later (portfolio and home projects) tilt too.
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(window.matchMedia('(hover: none)').matches) return; // skip touch devices

  const MAX_TILT = 8;
  let active = null;

  function release(card){
    card.style.transform = '';
  }

  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest ? e.target.closest('.tilt-card') : null;
    if(active && active !== card) release(active);
    active = card;
    if(!card) return;

    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * MAX_TILT * 2;
    const ry = (px - 0.5) * MAX_TILT * 2;
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  }, { passive:true });

  document.addEventListener('pointerleave', () => {
    if(active){ release(active); active = null; }
  });
})();
