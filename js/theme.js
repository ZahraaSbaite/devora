(function(){
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  if(!toggle) return;

  function updateLabel(){
    const isLight = root.getAttribute('data-theme') === 'light';
    toggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
  }
  updateLabel();

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('devora-theme', next);
    updateLabel();
    window.dispatchEvent(new CustomEvent('devora-theme-change', { detail: next }));
  });
})();
