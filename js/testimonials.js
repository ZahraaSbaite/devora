(function(){
  const track = document.getElementById('testimonialTrack');
  const prevBtn = document.getElementById('testimonialPrev');
  const nextBtn = document.getElementById('testimonialNext');
  const dotsWrap = document.getElementById('testimonialDots');
  if(!track) return;

  const slides = Array.from(track.children);
  let index = 0;
  let timer = null;

  if(dotsWrap){
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      if(i === 0) dot.classList.add('active');
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });
  }

  function goTo(i){
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    if(dotsWrap){
      Array.from(dotsWrap.children).forEach((d, di) => d.classList.toggle('active', di === index));
    }
  }

  if(prevBtn) prevBtn.addEventListener('click', () => { goTo(index - 1); restart(); });
  if(nextBtn) nextBtn.addEventListener('click', () => { goTo(index + 1); restart(); });

  function restart(){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    clearInterval(timer);
    timer = setInterval(() => goTo(index + 1), 6000);
  }
  restart();
})();
