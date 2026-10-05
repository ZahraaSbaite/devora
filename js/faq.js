(function(){
  const items = document.querySelectorAll('.faq-item');
  if(!items.length) return;

  items.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => i.classList.remove('open'));
      if(!isOpen) item.classList.add('open');
    });
  });
})();
