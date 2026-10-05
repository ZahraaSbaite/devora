import { FEATURED_PROJECTS, loadAllProjects, projectCardHtml, CATEGORY_LABELS } from './supabase-projects.js';

const filtersEl = document.getElementById('portfolioFilters');
const gridEl = document.getElementById('portfolioGrid');
if(filtersEl && gridEl){
  // Show the built-in projects right away, then swap in the merged list
  // once Supabase responds (it may include newer admin-added projects).
  render(FEATURED_PROJECTS);
  loadAllProjects().then(render);
}

function render(projects){
  // Only show filter pills for categories that actually have a project,
  // in a fixed, predictable order. Hide the bar when there's nothing to filter.
  const present = new Set(projects.map(p => p.category).filter(Boolean));
  const order = ['all', ...Object.keys(CATEGORY_LABELS)];
  filtersEl.hidden = present.size < 2;
  filtersEl.innerHTML = order
    .filter(key => key === 'all' || present.has(key))
    .map((key, i) => `<button type="button" class="filter-btn${i === 0 ? ' active' : ''}" data-filter="${key}">${key === 'all' ? 'All' : CATEGORY_LABELS[key]}</button>`)
    .join('');

  gridEl.innerHTML = projects.map(projectCardHtml).join('');
  requestAnimationFrame(() => {
    gridEl.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
  });

  wireFilters();
}

function wireFilters(){
  const buttons = filtersEl.querySelectorAll('.filter-btn');
  const cards = () => gridEl.querySelectorAll('.portfolio-card');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;

      cards().forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        if(match){
          card.style.display = '';
          requestAnimationFrame(() => card.classList.remove('is-filtered-out'));
        }else{
          card.classList.add('is-filtered-out');
          setTimeout(() => { if(card.classList.contains('is-filtered-out')) card.style.display = 'none'; }, 220);
        }
      });
    });
  });
}
