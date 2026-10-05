import { FEATURED_PROJECTS, loadAllProjects, projectCardHtml } from './supabase-projects.js';

const gridEl = document.getElementById('homePortfolioGrid');
if(gridEl){
  const render = projects => {
    gridEl.innerHTML = projects.slice(0, 3).map(projectCardHtml).join('');
    requestAnimationFrame(() => {
      gridEl.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible'));
    });
  };

  // Show the built-in projects right away, then swap in the merged list
  // once Supabase responds (it may include newer admin-added projects).
  render(FEATURED_PROJECTS);
  loadAllProjects().then(render);
}
