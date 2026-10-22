// Anonymous, cookie-free analytics for the public pages. Records a page view
// on load (with campaign tags if the link had ?utm_source=...), clicks on the
// main calls to action and project links, and the order funnel (first input
// in the order form, successful submit), into
// the analytics_events collection in Firestore. Nothing personal is
// sent: no IP is stored, and the visit id is random and lives only in this
// tab's sessionStorage.
import { FIREBASE_CONFIG, isConfigured } from './firebase-config.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', ''];
const skip =
  !isConfigured ||
  LOCAL_HOSTS.includes(location.hostname) ||       // don't count local previews
  navigator.doNotTrack === '1' || window.doNotTrack === '1';

// Firestore's REST API: one small request per event, no SDK download
const ENDPOINT = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}` +
  `/databases/(default)/documents/analytics_events?key=${FIREBASE_CONFIG.apiKey}`;

// Firestore REST wants every field typed
const field = v => v === null || v === undefined ? { nullValue: null } : { stringValue: String(v) };

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

// Campaign tags from links like ?utm_source=instagram&utm_campaign=bio.
// Only on the landing page view; cleaned to short lowercase slugs.
function campaign(){
  const params = new URLSearchParams(location.search);
  const out = {};
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(key => {
    const v = (params.get(key) || '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').slice(0, 60);
    if(v) out[key] = v;
  });
  return out;
}

function send(event){
  if(skip) return;
  const data = { label: null, referrer: null, ...event, path: pagePath(), session_id: sessionId(), device: device() };
  const fields = {};
  Object.entries(data).forEach(([k, v]) => { fields[k] = field(v); });
  fields.created_at = { timestampValue: new Date().toISOString() };
  fetch(ENDPOINT, {
    method: 'POST',
    keepalive: true, // lets click events finish while the browser navigates away
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  }).catch(() => {}); // analytics must never break the page
}

send({ type: 'pageview', referrer: referrer(), ...campaign() });

// Order funnel: the first time someone types in the order form...
const orderForm = document.getElementById('orderForm');
if(orderForm){
  orderForm.addEventListener('input', () => send({ type: 'form_start' }), { once: true });
}
// ...and a successful submit, announced by js/order.js
window.addEventListener('devora:track', e => {
  if(e.detail && e.detail.type === 'form_submit') send({ type: 'form_submit' });
});

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
