(function(){
  const cards = document.querySelectorAll('.tilt-card');
  if(!cards.length) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(window.matchMedia('(hover: none)').matches) return; // skip touch devices

  const MAX_TILT = 8;

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * MAX_TILT * 2;
      const ry = (px - 0.5) * MAX_TILT * 2;
      card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  });
})();
