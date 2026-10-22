import { getFirebase, isConfigured, docToObject } from './firebase-config.js';

// Human labels for each category value stored on a project row. Keep these
// keys in sync with the <option>/data-filter values in portfolio.html and
// admin.html's project form.
export const CATEGORY_LABELS = {
  websites: 'Websites',
  mobile: 'Mobile Apps',
  uiux: 'UI/UX'
};

// Maps a Firestore 'projects' document (snake_case fields) to the camelCase
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
// (portfolio.html, the home page teaser) — no sign-in needed; the security
// rules let anyone read projects.
export async function fetchProjects(){
  if(!isConfigured) return [];
  try{
    const { db, fs } = await getFirebase();
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'projects'), fs.orderBy('created_at', 'desc')));
    return snap.docs.map(d => mapProject(docToObject(d)));
  }catch(err){
    console.error('Failed to load projects:', err);
    return [];
  }
}

// The studio's client work. Shown on the site only as a fallback, while the
// Firestore projects collection is empty or unreachable; the admin Projects
// tab offers a one-click import of these, after which the database is the
// single source of truth (edit or delete them there).
export const FEATURED_PROJECTS = [
  {
    id: 'featured-strand-crochet',
    title: 'Strand',
    category: 'websites',
    description: 'Online shop for a handmade crochet studio — product catalog, cart and checkout, order tracking, custom commission requests, and an admin studio that runs the whole site.',
    tags: ['E-commerce', 'React', 'Admin dashboard'],
    imageUrl: 'assets/work/strand-crochet.jpg',
    liveUrl: 'https://strand-crochet.vercel.app/',
    caseStudyUrl: ''
  },
  {
    id: 'featured-abs-fragrances',
    title: 'ABS Fragrances',
    category: 'websites',
    description: 'E-commerce storefront for a Lebanese retailer of original UAE perfumes — browse by collection and gender, build a cart, and order straight through WhatsApp.',
    tags: ['E-commerce', 'Shopping cart', 'WhatsApp ordering'],
    imageUrl: 'assets/work/abs-fragrances.jpg',
    liveUrl: 'https://abs-fragrances.com',
    caseStudyUrl: ''
  },
  {
    id: 'featured-glowvie',
    title: 'Glow Vie',
    category: 'websites',
    description: 'Website for a Beirut beauty clinic — treatment menus with pricing, a before & after gallery, client reviews, and appointment booking.',
    tags: ['Booking', 'Service menu', 'Gallery'],
    imageUrl: 'assets/work/glowvie.jpg',
    liveUrl: 'https://glowvie-one.vercel.app/',
    caseStudyUrl: ''
  },
  {
    id: 'featured-ezz-travel',
    title: 'Ezz Travel',
    category: 'websites',
    description: 'Site for a luxury travel agency in Beirut and Abidjan — tailored trips, visas, VIP airport services, and spiritual travel packages.',
    tags: ['Travel', 'Lead generation', 'WhatsApp'],
    imageUrl: 'assets/work/ezz-travel.jpg',
    liveUrl: 'https://www.ezztravel.agency/',
    caseStudyUrl: ''
  }
];

// Admin-added projects (newest first) followed by the featured projects,
// skipping any featured entry the admin has already added with the same URL.
export async function loadAllProjects(){
  const remote = await fetchProjects();
  return remote.length ? remote : FEATURED_PROJECTS;
}

// Same site regardless of http/https, www or a trailing slash.
export function normalizeUrl(url){
  return (url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
}

// Escapes text for use inside HTML, including attribute values (quotes).
export function escapeHtml(str){
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Only web links (http/https) and site-relative paths are allowed in href/src;
// anything else (javascript:, data:, //other-host) becomes an empty string.
export function safeUrl(url){
  // browsers ignore tabs, newlines and control characters inside URLs
  // ("java\tscript:"), so drop them before checking the scheme
  const u = String(url || '').replace(/[\u0000-\u0020\u007f]+/g, '');
  if(/^https?:\/\//i.test(u)) return u;
  // site-relative paths: plain URL characters only, no scheme, no "//host"
  if(!u.startsWith('//') && /^\/?[\w\-.~%/?#=&+]+$/.test(u)) return u;
  return '';
}

// A cover image that fails to load is removed so the letter mark shows
// (a listener here instead of an inline onerror, so the CSP can forbid
// inline script).
document.addEventListener('error', e => {
  const img = e.target;
  if(img && img.tagName === 'IMG' && img.closest && img.closest('.portfolio-preview')) img.remove();
}, true);

// Builds one .portfolio-card element for a project. Shared by the
// portfolio page and the home page teaser so both stay visually identical.
export function projectCardHtml(project){
  const cat = CATEGORY_LABELS[project.category] || project.category || '';
  const tags = Array.isArray(project.tags) ? project.tags : [];
  // The letter mark always renders; the screenshot (if any) covers it and
  // removes itself if the file is missing, so a card never shows a broken image.
  const mark = `<span class="portfolio-mark">${escapeHtml((project.title || '?').charAt(0).toUpperCase())}</span>`;
  const imageUrl = safeUrl(project.imageUrl);
  const preview = imageUrl
    ? `${mark}<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(project.title)}" loading="lazy">`
    : mark;

  const links = [];
  const liveUrl = safeUrl(project.liveUrl);
  const caseStudyUrl = safeUrl(project.caseStudyUrl);
  if(liveUrl){
    links.push(`<a href="${escapeHtml(liveUrl)}" class="primary" target="_blank" rel="noopener noreferrer">Visit site →</a>`);
  }
  if(caseStudyUrl){
    links.push(`<a href="${escapeHtml(caseStudyUrl)}" target="_blank" rel="noopener noreferrer">Case study</a>`);
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
