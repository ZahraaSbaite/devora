// Anonymous, cookie-free analytics for the public pages. Records a page view
// on load and a click on the main calls to action and project links, into
// the analytics_events table (supabase/analytics.sql). Nothing personal is
// sent: no IP is stored, and the visit id is random and lives only in this
// tab's sessionStorage.
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './supabase-config.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', ''];
const skip =
  !isConfigured ||
  LOCAL_HOSTS.includes(location.hostname) ||       // don't count local previews
  navigator.doNotTrack === '1' || window.doNotTrack === '1';

const ENDPOINT = `${SUPABASE_URL}/rest/v1/analytics_events`;

function sessionId(){
  try{
    let id = sessionStorage.getItem('devora-visit');
    if(!id){
      id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
      sessionStorage.setItem('devora-visit', id);
    }
    return id;
  }catch(err){
    return 'nostorage-' + Math.random().toString(36).slice(2, 12);
  }
}

function device(){
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
}

// "/" and "/index.html" are the same page
function pagePath(){
  const p = location.pathname.replace(/\/index\.html$/, '/');
  return p.slice(0, 200) || '/';
}

// only the referring site's domain, and only when it's another site
function referrer(){
  try{
    if(!document.referrer) return 'direct';
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    return host === location.hostname.replace(/^www\./, '') ? null : host.slice(0, 120);
  }catch(err){
    return null;
  }
}

function send(event){
  if(skip) return;
  const body = JSON.stringify({ ...event, path: pagePath(), session_id: sessionId(), device: device() });
  fetch(ENDPOINT, {
    method: 'POST',
    keepalive: true, // lets click events finish while the browser navigates away
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal'
    },
    body
  }).catch(() => {}); // analytics must never break the page
}

send({ type: 'pageview', referrer: referrer() });

// Clicks worth knowing about: calls to action and project "Visit site" links.
document.addEventListener('click', e => {
  const link = e.target.closest && e.target.closest('a');
  if(!link) return;
  let label = null;
  const card = link.closest('.portfolio-card');
  if(card){
    const title = card.querySelector('h3');
    label = 'Project: ' + (title ? title.textContent.trim() : link.href);
  }else if(link.matches('.btn-primary, .btn-secondary, .nav-cta, .svc-row')){
    const text = (link.querySelector('h3') || link).textContent
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}?!.)]+$/u, '') // drop trailing arrows and symbols
      .trim();
    label = text;
  }
  if(label) send({ type: 'click', label: label.slice(0, 120) });
}, { capture: true });
