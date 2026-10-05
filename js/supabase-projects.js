import { getSupabase, isConfigured } from './supabase-config.js';

// Human labels for each category value stored on a project row. Keep these
// keys in sync with the <option>/data-filter values in portfolio.html and
// admin.html's project form.
export const CATEGORY_LABELS = {
  websites: 'Websites',
  mobile: 'Mobile Apps',
  uiux: 'UI/UX'
};

// Maps a Supabase 'projects' row (snake_case columns) to the camelCase
// shape the rest of the front end expects.
function mapProject(row){
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags || [],
    imageUrl: row.image_url || '',
    liveUrl: row.live_url || '',
    caseStudyUrl: row.case_study_url || '',
    createdAt: row.created_at
  };
}

// One-time read of every project, newest first. Used by public pages
// (portfolio.html, the home page teaser) — no auth required, matches the
// "select using (true)" RLS policy on the projects table.
export async function fetchProjects(){
  if(!isConfigured) return [];
  try{
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if(error){ console.error('Failed to load projects:', error); return []; }
    return (data || []).map(mapProject);
  }catch(err){
    console.error('Failed to load projects:', err);
    return [];
  }
}

// Shipped client work that always appears on the site, even if Supabase is
// unreachable or the projects table is empty. Projects added through the
// admin panel are shown alongside these.
export const FEATURED_PROJECTS = [
  {
    id: 'featured-abs-fragrances',
    title: 'ABS Fragrances',
    category: 'websites',
    description: 'E-commerce storefront for a Lebanese retailer of original UAE perfumes — browse by collection and gender, build a cart, and order straight through WhatsApp.',
    tags: ['E-commerce', 'Shopping cart', 'WhatsApp ordering'],
    imageUrl: 'assets/work/abs-fragrances.png',
    liveUrl: 'https://abs-fragrances.com',
    caseStudyUrl: ''
  },
  {
    id: 'featured-glowvie',
    title: 'Glow Vie',
    category: 'websites',
    description: 'Website for a Beirut beauty clinic — treatment menus with pricing, a before & after gallery, client reviews, and appointment booking.',
    tags: ['Booking', 'Service menu', 'Gallery'],
    imageUrl: 'assets/work/glowvie.png',
    liveUrl: 'https://glowvie-one.vercel.app/',
    caseStudyUrl: ''
  },
  {
    id: 'featured-ezz-travel',
    title: 'Ezz Travel',
    category: 'websites',
    description: 'Site for a luxury travel agency in Beirut and Abidjan — tailored trips, visas, VIP airport services, and spiritual travel packages.',
    tags: ['Travel', 'Lead generation', 'WhatsApp'],
    imageUrl: 'assets/work/ezz-travel.png',
    liveUrl: 'https://www.ezztravel.agency/',
    caseStudyUrl: ''
  }
];

// Supabase projects (newest first) followed by the featured projects,
// skipping any featured entry the admin has already added with the same URL.
export async function loadAllProjects(){
  const remote = await fetchProjects();
  const norm = url => (url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
  const seen = new Set(remote.map(p => norm(p.liveUrl)).filter(Boolean));
  return [...remote, ...FEATURED_PROJECTS.filter(p => !seen.has(norm(p.liveUrl)))];
}

export function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// Builds one .portfolio-card element for a project. Shared by the
// portfolio page and the home page teaser so both stay visually identical.
export function projectCardHtml(project){
  const cat = CATEGORY_LABELS[project.category] || project.category || '';
  const tags = Array.isArray(project.tags) ? project.tags : [];
  // The letter mark always renders; the screenshot (if any) covers it and
  // removes itself if the file is missing, so a card never shows a broken image.
  const mark = `<span class="portfolio-mark">${escapeHtml((project.title || '?').charAt(0).toUpperCase())}</span>`;
  const preview = project.imageUrl
    ? `${mark}<img src="${escapeHtml(project.imageUrl)}" alt="${escapeHtml(project.title)}" loading="lazy" onerror="this.remove()">`
    : mark;

  const links = [];
  if(project.liveUrl){
    links.push(`<a href="${escapeHtml(project.liveUrl)}" class="primary" target="_blank" rel="noopener">Visit site →</a>`);
  }
  if(project.caseStudyUrl){
    links.push(`<a href="${escapeHtml(project.caseStudyUrl)}" target="_blank" rel="noopener">Case study</a>`);
  }

  return `
    <div class="portfolio-card tilt-card reveal" data-category="${escapeHtml(project.category || '')}">
      <div class="portfolio-preview">${preview}</div>
      <div class="portfolio-body">
        <span class="portfolio-cat">${escapeHtml(cat)}</span>
        <h3>${escapeHtml(project.title || 'Untitled project')}</h3>
        <p class="desc">${escapeHtml(project.description || '')}</p>
        ${tags.length ? `<div class="portfolio-tags">${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${links.length ? `<div class="portfolio-actions">${links.join('')}</div>` : ''}
      </div>
    </div>`;
}
