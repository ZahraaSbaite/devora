// Admin → Analytics tab. Reads anonymous visit events (analytics_events,
// recorded by js/track.js) and orders, for a chosen date range, and draws:
// KPI tiles with change vs the previous period, daily traffic, top pages,
// traffic sources, devices, most-clicked links, and orders by status/type.
// Charts are plain SVG/HTML; every value is also reachable in a table view.
import { getFirebase, docToObject } from './firebase-config.js';

const SVG = 'http://www.w3.org/2000/svg';
const DAY = 86400000;
const PAGE_NAMES = {
  '/': 'Home', '/about': 'About', '/services': 'Services', '/portfolio': 'Portfolio',
  '/process': 'Process', '/faq': 'FAQ', '/contact': 'Contact', '/privacy': 'Privacy', '/terms': 'Terms'
};
// "/contact.html" and "/contact" are the same page
const pageKey = path => (path || '/').replace(/\.html$/, '') || '/';
const pageName = path => PAGE_NAMES[pageKey(path)] || path;
const STATUS_ORDER = [
  ['new', 'New'], ['contacted', 'Contacted'], ['in_progress', 'In progress'],
  ['completed', 'Completed'], ['archived', 'Archived']
];
const DEVICE_ORDER = [['desktop', 'Desktop'], ['mobile', 'Mobile'], ['tablet', 'Tablet']];

let root, tooltip, rangeDays = 30, lastData = null;

export function initAnalytics(container){
  if(root) return refresh(); // already set up: just reload
  root = container;
  tooltip = el('div', { class: 'an-tooltip', role: 'status', hidden: '' });
  document.body.appendChild(tooltip);

  root.querySelectorAll('[data-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      rangeDays = Number(btn.dataset.range);
      root.querySelectorAll('[data-range]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      refresh();
    });
  });
  root.querySelector('#anRefresh').addEventListener('click', refresh);
  wireLinkBuilder();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if(lastData && !root.hidden) draw(lastData); }, 150);
  });
  return refresh();
}

// ---------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------
async function refresh(){
  const body = root.querySelector('#anBody');
  body.classList.add('is-loading'); // keep the previous render, dimmed
  try{
    const firebase = await getFirebase();
    const now = new Date();
    const start = startOfDay(new Date(now.getTime() - (rangeDays - 1) * DAY));
    const prevStart = new Date(start.getTime() - rangeDays * DAY);

    const [events, orders] = await Promise.all([
      fetchSince(firebase, 'analytics_events', prevStart),
      fetchSince(firebase, 'orders', prevStart)
    ]);
    lastData = { events, orders, start, prevStart, now };
    notice(events.length ? null : 'empty');
    draw(lastData);
    root.querySelector('#anUpdated').textContent = 'Updated ' + now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }catch(err){
    console.error('Analytics load failed:', err);
    notice(err.code === 'permission-denied' ? 'setup' : 'error');
  }finally{
    body.classList.remove('is-loading');
  }
}

// Every document in a collection created on or after `since`, oldest first,
// as plain objects with ISO date strings.
async function fetchSince({ db, fs }, name, since){
  const q = fs.query(fs.collection(db, name),
    fs.where('created_at', '>=', fs.Timestamp.fromDate(since)),
    fs.orderBy('created_at', 'asc'));
  const snap = await fs.getDocs(q);
  return snap.docs.map(docToObject);
}

function notice(kind){
  const box = root.querySelector('#anNotice');
  const messages = {
    setup: ["Analytics can't be read yet.", 'Publish the rules from firestore.rules in Firebase (Firestore Database → Rules) and make sure your account is in the admins collection, then press Refresh.'],
    empty: ['No visits recorded in this period yet.', 'Visits are recorded on the live site only — previews on your own computer aren\'t counted. Order charts below still use your real orders.'],
    error: ['Couldn\'t load analytics.', 'Check your connection, then press Refresh.']
  };
  if(!kind){ box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(el('strong', {}, messages[kind][0]), ' ', messages[kind][1]);
}

// ---------------------------------------------------------------------
// Aggregation + drawing
// ---------------------------------------------------------------------
function draw({ events, orders, start, prevStart }){
  const inCur = r => new Date(r.created_at) >= start;
  const inPrev = r => { const t = new Date(r.created_at); return t >= prevStart && t < start; };
  const views = events.filter(e => e.type === 'pageview');
  const curViews = views.filter(inCur), prevViews = views.filter(inPrev);
  const curOrders = orders.filter(inCur), prevOrders = orders.filter(inPrev);
  const curVisits = new Set(curViews.map(v => v.session_id)).size;
  const prevVisits = new Set(prevViews.map(v => v.session_id)).size;

  // daily buckets for the current period
  const days = [];
  for(let i = 0; i < rangeDays; i++) days.push(new Date(start.getTime() + i * DAY));
  const dayIndex = r => Math.floor((startOfDay(new Date(r.created_at)) - start) / DAY);
  const dailyViews = days.map(() => 0), dailySessions = days.map(() => new Set()), dailyOrders = days.map(() => 0);
  curViews.forEach(v => { const i = dayIndex(v); if(i >= 0 && i < rangeDays){ dailyViews[i]++; dailySessions[i].add(v.session_id); } });
  curOrders.forEach(o => { const i = dayIndex(o); if(i >= 0 && i < rangeDays) dailyOrders[i]++; });
  const dailyVisits = dailySessions.map(s => s.size);

  const conv = v => v.visits ? v.orders / v.visits * 100 : null;
  const curConv = conv({ visits: curVisits, orders: curOrders.length });
  const prevConv = conv({ visits: prevVisits, orders: prevOrders.length });

  const period = `previous ${rangeDays} days`;
  const kpis = root.querySelector('#anKpis');
  kpis.replaceChildren(
    statTile('Visits', curVisits, prevVisits, dailyVisits, period),
    statTile('Page views', curViews.length, prevViews.length, dailyViews, period),
    statTile('Orders', curOrders.length, prevOrders.length, dailyOrders, period),
    statTile('Conversion rate', curConv, prevConv, null, period, { percent: true })
  );

  lineChart(root.querySelector('#anTraffic'), days, [
    { name: 'Page views', color: 'var(--series-1)', values: dailyViews },
    { name: 'Visits', color: 'var(--series-2)', values: dailyVisits }
  ]);

  // ---- order funnel: how many visits reached each step ----
  const curEvents = events.filter(inCur);
  const visitsWhere = test => new Set(curEvents.filter(test).map(e => e.session_id));
  const sVisits = new Set(curViews.map(v => v.session_id));
  const sContact = visitsWhere(e => e.type === 'pageview' && pageKey(e.path) === '/contact');
  const sStarted = visitsWhere(e => e.type === 'form_start');
  const sSent = visitsWhere(e => e.type === 'form_submit');
  funnel(root.querySelector('#anFunnel'), [
    { label: 'Visited the site', value: sVisits.size },
    { label: 'Saw the Contact page', value: sContact.size },
    { label: 'Started the order form', value: sStarted.size },
    { label: 'Sent an order', value: sSent.size }
  ]);

  // ---- campaigns: tags come from the visit's landing page view ----
  const groups = new Map();
  curViews.forEach(v => {
    if(!v.utm_source) return;
    const key = v.utm_source + '\u0000' + (v.utm_campaign || '');
    if(!groups.has(key)) groups.set(key, { source: v.utm_source, campaign: v.utm_campaign || '—', visits: new Set() });
    groups.get(key).visits.add(v.session_id);
  });
  const campaignRows = [...groups.values()]
    .sort((a, b) => b.visits.size - a.visits.size)
    .map(g => {
      const ids = [...g.visits];
      const started = ids.filter(id => sStarted.has(id)).length;
      const sent = ids.filter(id => sSent.has(id)).length;
      return [g.source, g.campaign, fmt(ids.length), fmt(started), fmt(sent), pct(sent, ids.length)];
    });
  table(root.querySelector('#anCampaigns'), ['Source', 'Campaign', 'Visits', 'Started form', 'Sent order', 'Conversion'],
    campaignRows, 'No tagged visits yet — make a link below and use it on Instagram.');

  hbar(root.querySelector('#anPages'), top(countBy(curViews, v => pageName(v.path)), 8), 'Page views');

  // a visit's source is the referrer on its first page view
  const firstView = new Map();
  curViews.forEach(v => { if(!firstView.has(v.session_id)) firstView.set(v.session_id, v); });
  const sources = countBy([...firstView.values()].filter(v => v.referrer), v => v.referrer === 'direct' ? 'Direct / none' : v.referrer);
  hbar(root.querySelector('#anSources'), top(sources, 8), 'Visits');

  const devices = countBy([...firstView.values()], v => v.device);
  stackedShare(root.querySelector('#anDevices'), DEVICE_ORDER.map(([k, label], i) => ({
    label, value: devices.get(k) || 0, color: `var(--series-${i + 1})`
  })));

  const clicks = top(countBy(events.filter(e => e.type === 'click' && inCur(e)), e => e.label || 'Unlabelled'), 10);
  table(root.querySelector('#anClicks'), ['Link', 'Clicks'], clicks.map(r => [r.label, fmt(r.value)]), 'No clicks recorded in this period.');

  const statusCounts = countBy(curOrders, o => o.status || 'new');
  hbar(root.querySelector('#anStatus'), STATUS_ORDER.map(([k, label]) => ({ label, value: statusCounts.get(k) || 0 })), 'Orders', { keepZero: true });

  hbar(root.querySelector('#anTypes'), top(countBy(curOrders, o => prettify(o.project_type) || 'Not specified'), 8), 'Orders');
}

// ---------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------
function statTile(label, value, prev, series, period, { percent = false } = {}){
  const tile = el('div', { class: 'an-tile' });
  tile.append(el('span', { class: 'an-tile-label' }, label));
  tile.append(el('span', { class: 'an-tile-value' }, value === null ? '—' : percent ? value.toFixed(1) + '%' : fmt(value)));

  // delta: percent change for counts, percentage points for the rate
  let deltaText = 'No earlier data', dir = 0;
  if(value !== null && prev !== null && (percent || prev > 0)){
    const d = percent ? value - prev : (value - prev) / prev * 100;
    dir = Math.sign(Math.round(d * 10)); // a change that rounds to 0.0 counts as no change
    deltaText = (dir > 0 ? '+' : dir < 0 ? '−' : '±') + Math.abs(d).toFixed(1) + (percent ? ' pts' : '%');
  }
  const delta = el('span', { class: 'an-tile-delta' + (dir > 0 ? ' is-up' : dir < 0 ? ' is-down' : '') });
  if(dir) delta.append(el('span', { 'aria-hidden': 'true' }, dir > 0 ? '▲ ' : '▼ '));
  delta.append(deltaText, el('span', { class: 'an-tile-period' }, ` vs ${period}`));
  tile.append(delta);

  if(series) tile.append(sparkline(series));
  return tile;
}

function sparkline(values){
  const w = 120, h = 28, max = Math.max(1, ...values);
  const x = i => values.length < 2 ? w : i / (values.length - 1) * (w - 6) + 3;
  const y = v => h - 3 - v / max * (h - 6);
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, class: 'an-spark', 'aria-hidden': 'true' });
  svg.append(svgEl('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'an-spark-line' }));
  const last = values.length - 1;
  svg.append(svgEl('circle', { cx: x(last), cy: y(values[last]), r: 3.5, class: 'an-spark-dot' }));
  return svg;
}

function lineChart(host, days, series){
  host.replaceChildren();
  const legend = el('div', { class: 'an-legend' });
  series.forEach(s => legend.append(el('span', { class: 'an-legend-item' },
    el('span', { class: 'an-key-line', style: `background:${s.color}` }), s.name)));
  host.append(legend);

  const width = Math.max(300, host.clientWidth), height = 260;
  const m = { top: 12, right: 16, bottom: 28, left: 40 };
  const iw = width - m.left - m.right, ih = height - m.top - m.bottom;
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  const ticks = [0, max / 4, max / 2, max * 3 / 4, max];
  const x = i => m.left + (days.length < 2 ? iw / 2 : i / (days.length - 1) * iw);
  const y = v => m.top + ih - v / max * ih;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'an-svg', role: 'img',
    'aria-label': `Daily ${series.map(s => s.name.toLowerCase()).join(' and ')}`, tabindex: '0' });
  ticks.forEach(t => {
    svg.append(svgEl('line', { x1: m.left, x2: width - m.right, y1: y(t), y2: y(t), class: t === 0 ? 'an-axis' : 'an-gridline' }));
    const lbl = svgEl('text', { x: m.left - 8, y: y(t) + 4, class: 'an-tick', 'text-anchor': 'end' });
    lbl.textContent = compact(t);
    svg.append(lbl);
  });
  const step = Math.max(1, Math.ceil(days.length / 6));
  days.forEach((d, i) => {
    if(i % step && i !== days.length - 1) return;
    const lbl = svgEl('text', { x: x(i), y: height - 8, class: 'an-tick', 'text-anchor': i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle' });
    lbl.textContent = shortDate(d);
    svg.append(lbl);
  });
  series.forEach(s => {
    svg.append(svgEl('polyline', { points: s.values.map((v, i) => `${x(i)},${y(v)}`).join(' '),
      class: 'an-line', style: `stroke:${s.color}` }));
    const last = s.values.length - 1;
    svg.append(svgEl('circle', { cx: x(last), cy: y(s.values[last]), r: 4, class: 'an-dot', style: `fill:${s.color}` }));
  });

  // crosshair + one tooltip listing every series at that day
  const cross = svgEl('line', { y1: m.top, y2: m.top + ih, class: 'an-cross', visibility: 'hidden' });
  const hoverDots = series.map(s => svgEl('circle', { r: 4.5, class: 'an-dot', style: `fill:${s.color}`, visibility: 'hidden' }));
  svg.append(cross, ...hoverDots);
  let active = -1;
  const show = (i, clientX, clientY) => {
    active = i;
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    hoverDots.forEach((dot, k) => { dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(series[k].values[i])); dot.setAttribute('visibility', 'visible'); });
    showTooltip(longDate(days[i]), series.map(s => ({ name: s.name, value: fmt(s.values[i]), color: s.color })), clientX, clientY);
  };
  const hide = () => {
    active = -1;
    cross.setAttribute('visibility', 'hidden');
    hoverDots.forEach(d => d.setAttribute('visibility', 'hidden'));
    hideTooltip();
  };
  const hit = svgEl('rect', { x: m.left, y: m.top, width: iw, height: ih, class: 'an-hit' });
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    const px = (e.clientX - r.left) * (width / r.width);
    const i = Math.max(0, Math.min(days.length - 1, Math.round((px - m.left) / iw * (days.length - 1))));
    show(i, e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', hide);
  svg.addEventListener('keydown', e => {
    if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = Math.max(0, Math.min(days.length - 1, (active < 0 ? days.length - 1 : active + (e.key === 'ArrowRight' ? 1 : -1))));
    const r = svg.getBoundingClientRect();
    show(i, r.left + x(i) * (r.width / width), r.top + m.top);
  });
  svg.addEventListener('blur', hide);
  svg.append(hit);
  host.append(svg);

  host.append(tableView(['Day', ...series.map(s => s.name)],
    days.map((d, i) => [longDate(d), ...series.map(s => fmt(s.values[i]))])));
}

function funnel(host, steps){
  host.replaceChildren();
  const top = steps[0].value;
  if(!top){ host.append(el('p', { class: 'an-empty' }, 'Nothing recorded in this period.')); return; }
  const list = el('div', { class: 'an-bars an-funnel' });
  steps.forEach((s, i) => {
    const prev = i ? steps[i - 1].value : null;
    const row = el('div', { class: 'an-bar-row', tabindex: '0' });
    const label = el('span', { class: 'an-bar-label', title: s.label }, s.label);
    const track = el('span', { class: 'an-bar-track' });
    track.append(
      el('span', { class: 'an-bar', style: `width:${s.value / top * 100}%` }),
      el('span', { class: 'an-bar-value' }, fmt(s.value)),
      el('span', { class: 'an-funnel-pct' }, i ? `${pct(s.value, prev)} of previous step` : ''));
    row.append(label, track);
    const tip = e => {
      const rect = row.getBoundingClientRect();
      const rows = [{ name: 'Visits', value: fmt(s.value), color: 'var(--series-1)' }];
      if(i) rows.push({ name: 'of previous step', value: pct(s.value, prev), color: 'var(--series-1)' },
                      { name: 'of all visits', value: pct(s.value, top), color: 'var(--series-1)' });
      showTooltip(s.label, rows, e && e.clientX ? e.clientX : rect.left + rect.width / 2, e && e.clientY ? e.clientY : rect.top);
    };
    row.addEventListener('pointermove', tip);
    row.addEventListener('focus', () => tip());
    row.addEventListener('pointerleave', hideTooltip);
    row.addEventListener('blur', hideTooltip);
    list.append(row);
  });
  host.append(list, tableView(['Step', 'Visits', 'Of all visits', 'Of previous step'],
    steps.map((s, i) => [s.label, fmt(s.value), pct(s.value, top), i ? pct(s.value, steps[i - 1].value) : '—'])));
}

function hbar(host, rows, valueName, { keepZero = false } = {}){
  host.replaceChildren();
  rows = keepZero ? rows : rows.filter(r => r.value > 0);
  if(!rows.length){ host.append(el('p', { class: 'an-empty' }, 'Nothing recorded in this period.')); return; }
  const max = Math.max(1, ...rows.map(r => r.value));
  const list = el('div', { class: 'an-bars' });
  rows.forEach(r => {
    const row = el('div', { class: 'an-bar-row', tabindex: '0' });
    row.append(el('span', { class: 'an-bar-label', title: r.label }, r.label));
    const track = el('span', { class: 'an-bar-track' });
    const bar = el('span', { class: 'an-bar', style: `width:${r.value / max * 100}%` });
    track.append(bar, el('span', { class: 'an-bar-value' }, fmt(r.value)));
    row.append(track);
    const tip = e => {
      const rect = row.getBoundingClientRect();
      showTooltip(r.label, [{ name: valueName, value: fmt(r.value), color: 'var(--series-1)' }],
        e && e.clientX ? e.clientX : rect.left + rect.width / 2, e && e.clientY ? e.clientY : rect.top);
    };
    row.addEventListener('pointermove', tip);
    row.addEventListener('focus', () => tip());
    row.addEventListener('pointerleave', hideTooltip);
    row.addEventListener('blur', hideTooltip);
    list.append(row);
  });
  host.append(list, tableView([valueName === 'Orders' ? 'Category' : 'Name', valueName], rows.map(r => [r.label, fmt(r.value)])));
}

function stackedShare(host, parts){
  host.replaceChildren();
  const total = parts.reduce((a, p) => a + p.value, 0);
  if(!total){ host.append(el('p', { class: 'an-empty' }, 'Nothing recorded in this period.')); return; }
  const bar = el('div', { class: 'an-stack', role: 'img',
    'aria-label': parts.map(p => `${p.label} ${pct(p.value, total)}`).join(', ') });
  const legend = el('div', { class: 'an-legend an-legend-stack' });
  parts.forEach(p => {
    if(p.value){
      const seg = el('span', { class: 'an-seg', tabindex: '0', style: `flex-grow:${p.value}; background:${p.color}` });
      const tip = e => {
        const rect = seg.getBoundingClientRect();
        showTooltip(p.label, [{ name: 'Share of visits', value: `${pct(p.value, total)} · ${fmt(p.value)}`, color: p.color }],
          e && e.clientX ? e.clientX : rect.left + rect.width / 2, e && e.clientY ? e.clientY : rect.top);
      };
      seg.addEventListener('pointermove', tip);
      seg.addEventListener('focus', () => tip());
      seg.addEventListener('pointerleave', hideTooltip);
      seg.addEventListener('blur', hideTooltip);
      bar.append(seg);
    }
    legend.append(el('span', { class: 'an-legend-item' },
      el('span', { class: 'an-key-rect', style: `background:${p.color}` }), p.label,
      el('strong', {}, pct(p.value, total))));
  });
  host.append(bar, legend, tableView(['Device', 'Visits', 'Share'], parts.map(p => [p.label, fmt(p.value), pct(p.value, total)])));
}

function table(host, head, rows, emptyText){
  host.replaceChildren();
  if(!rows.length){ host.append(el('p', { class: 'an-empty' }, emptyText)); return; }
  host.append(buildTable(head, rows));
}

function tableView(head, rows){
  const details = el('details', { class: 'an-table-view' });
  details.append(el('summary', {}, 'View as table'), buildTable(head, rows));
  return details;
}

function buildTable(head, rows){
  const t = el('table', { class: 'an-table' });
  // right-align a column only when every value in it is a number or percentage
  const numeric = head.map((h, i) => i > 0 && rows.every(r => /^[\d.,]+[%KM]?$|^—$/.test(String(r[i]).trim())));
  const thead = el('thead'), tr = el('tr');
  head.forEach((h, i) => tr.append(el('th', numeric[i] ? { class: 'num' } : {}, h)));
  thead.append(tr);
  const tbody = el('tbody');
  rows.forEach(r => {
    const row = el('tr');
    r.forEach((c, i) => row.append(el('td', numeric[i] ? { class: 'num' } : {}, c)));
    tbody.append(row);
  });
  t.append(thead, tbody);
  return t;
}

// ---------------------------------------------------------------------
// Tagged-link builder (same cleaning rules as js/track.js)
// ---------------------------------------------------------------------
function wireLinkBuilder(){
  const page = root.querySelector('#anLinkPage');
  const source = root.querySelector('#anLinkSource');
  const campaign = root.querySelector('#anLinkCampaign');
  const out = root.querySelector('#anLinkOut');
  const copy = root.querySelector('#anLinkCopy');
  const slug = v => v.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').slice(0, 60);
  const base = location.origin + location.pathname.replace(/admin(\.html)?$/, '');
  const update = () => {
    const params = new URLSearchParams();
    if(slug(source.value)) params.set('utm_source', slug(source.value));
    if(slug(campaign.value)) params.set('utm_campaign', slug(campaign.value));
    const qs = params.toString();
    out.value = base + page.value + (qs ? '?' + qs : '');
  };
  [page, source, campaign].forEach(input => input.addEventListener('input', update));
  copy.addEventListener('click', async () => {
    try{ await navigator.clipboard.writeText(out.value); }
    catch(err){ out.select(); document.execCommand('copy'); }
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
  });
  update();
}

// ---------------------------------------------------------------------
// Tooltip (labels go in with textContent, never innerHTML)
// ---------------------------------------------------------------------
function showTooltip(title, rows, clientX, clientY){
  tooltip.replaceChildren(el('span', { class: 'an-tip-title' }, title));
  rows.forEach(r => tooltip.append(el('span', { class: 'an-tip-row' },
    el('span', { class: 'an-key-line', style: `background:${r.color}` }),
    el('strong', {}, r.value), el('span', {}, r.name))));
  tooltip.hidden = false;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let left = clientX + 14, top = clientY - th - 12;
  if(left + tw > window.innerWidth - 8) left = clientX - tw - 14;
  if(top < 8) top = clientY + 16;
  tooltip.style.transform = `translate(${left}px, ${top}px)`;
}
function hideTooltip(){ tooltip.hidden = true; }

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function el(tag, attrs = {}, ...children){
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.forEach(c => node.append(c));
  return node;
}
function svgEl(tag, attrs = {}){
  const node = document.createElementNS(SVG, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}
function countBy(rows, key){
  const m = new Map();
  rows.forEach(r => { const k = key(r); m.set(k, (m.get(k) || 0) + 1); });
  return m;
}
function top(map, n){
  return [...map.entries()].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, n);
}
function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function niceMax(v){
  if(v <= 20) return Math.max(4, Math.ceil(v / 4) * 4); // small counts: quarter ticks stay whole numbers
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 4, 5, 10].map(k => k * p).find(c => c >= v) || 10 * p;
}
function fmt(n){ return n >= 10000 ? compact(n) : Math.round(n).toLocaleString(); }
function compact(n){
  if(n >= 1e6) return +(n / 1e6).toFixed(1) + 'M';
  if(n >= 1e3) return +(n / 1e3).toFixed(1) + 'K';
  return String(+n.toFixed(1));
}
function pct(v, total){ return total ? Math.round(v / total * 100) + '%' : '0%'; }
function shortDate(d){ return d.toLocaleDateString([], { month:'short', day:'numeric' }); }
function longDate(d){ return d.toLocaleDateString([], { weekday:'short', month:'short', day:'numeric' }); }
function prettify(s){
  if(!s) return null;
  const t = String(s).replace(/[-_]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
