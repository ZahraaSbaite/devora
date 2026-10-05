(function(){
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  const header = document.getElementById('siteHeader');
  if(header){
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
  }

  const menuBtn = document.getElementById('menuBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavClose = document.getElementById('mobileNavClose');
  if(menuBtn && mobileNav){
    menuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });
    if(mobileNavClose){
      mobileNavClose.addEventListener('click', () => mobileNav.classList.remove('open'));
    }
    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => mobileNav.classList.remove('open'));
    });
  }

  // highlight the current page in nav
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav.links a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if(!href || href.startsWith('#')) return;
    if(href === path) a.classList.add('active');
  });
})();
