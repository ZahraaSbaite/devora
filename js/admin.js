import { getFirebase, isConfigured, docToObject } from './firebase-config.js';
import { onAuthReady, checkAdmin, logout } from './auth.js';
import { CATEGORY_LABELS, escapeHtml, safeUrl, FEATURED_PROJECTS, normalizeUrl } from './projects.js';

const gate = document.getElementById('adminGate');
const panel = document.getElementById('adminPanel');
const list = document.getElementById('ordersList');
const emptyState = document.getElementById('ordersEmpty');
const statusFilter = document.getElementById('statusFilter');
const searchInput = document.getElementById('orderSearch');
const exportBtn = document.getElementById('exportOrdersBtn');
const newBadge = document.getElementById('ordersNewBadge');
const statCards = {
  total: document.getElementById('statTotal'),
  new: document.getElementById('statNew'),
  progress: document.getElementById('statProgress'),
  done: document.getElementById('statDone')
};
const logoutBtn = document.getElementById('adminLogoutBtn');
if(logoutBtn) logoutBtn.addEventListener('click', logout);

const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived'
};

const SEARCH_FIELDS = ['name', 'email', 'company', 'phone', 'project_type', 'budget', 'timeline', 'details', 'admin_notes'];

let allOrders = [];
// survive the re-render that every live update triggers
const expandedOrders = new Set();
const noteDrafts = new Map();

(async function init(){
  const user = await onAuthReady();
  if(!user){
    showGate('Please log in with an admin account to view orders.', true);
    return;
  }
  const access = await checkAdmin(user);
  if(access === 'error'){
    showGate('Couldn\'t confirm your access — check your connection and refresh the page.', false);
    return;
  }
  if(access !== 'yes'){
    showGate('This account doesn\'t have admin access.', false);
    return;
  }

  gate.hidden = true;
  panel.hidden = false;
  wireTabs();
  wireProjectForm();
  await streamOrders();
  await streamProjects();
})();

function showGate(message, showLoginLink){
  gate.hidden = false;
  panel.hidden = true;
  const msgEl = document.getElementById('adminGateMessage');
  if(msgEl) msgEl.textContent = message;
  const loginLink = document.getElementById('adminGateLogin');
  if(loginLink) loginLink.style.display = showLoginLink ? 'inline-flex' : 'none';
}

// ---------------------------------------------------------------------
// Orders — a live Firestore listener keeps one in-memory list (allOrders)
// and re-renders whenever anything in the collection changes.
// ---------------------------------------------------------------------
async function streamOrders(){
  if(!isConfigured) return;
  try{
    const { db, fs } = await getFirebase();
    const q = fs.query(fs.collection(db, 'orders'), fs.orderBy('created_at', 'desc'));
    fs.onSnapshot(q, snap => {
      allOrders = snap.docs.map(docToObject);
      render();
    }, err => {
      console.error('Orders load failed:', err);
      if(emptyState){
        emptyState.hidden = false;
        emptyState.textContent = 'Couldn\'t load orders — check your connection and the Firestore security rules.';
      }
    });
  }catch(err){
    console.error('Failed to start orders stream:', err);
  }
}

// Orders currently shown: the status filter plus the search box.
function visibleOrders(){
  const filter = statusFilter ? statusFilter.value : 'all';
  const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
  return allOrders.filter(o => {
    if(filter !== 'all' && (o.status || 'new') !== filter) return false;
    if(!term) return true;
    return SEARCH_FIELDS.some(key => String(o[key] || '').toLowerCase().includes(term));
  });
}

// A plain address only, so a submitted value can't smuggle extra mailto
// parameters (?cc=, &body=) into the reply link.
function replyLink(order){
  const email = (order.email || '').trim();
  if(!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) return '';
  const subject = encodeURIComponent(`Re: your ${order.project_type ? order.project_type.toLowerCase() + ' ' : ''}project with Devora`);
  const body = encodeURIComponent(`Hi ${order.name || ''},\n\nThanks for reaching out about your project.\n\n`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function phoneDigits(order){
  const digits = (order.phone || '').replace(/\D/g, '');
  return digits.length >= 7 ? digits : '';
}

function render(){
  const orders = visibleOrders();
  const newCount = allOrders.filter(o => (o.status || 'new') === 'new').length;

  if(statCards.total) statCards.total.textContent = allOrders.length;
  if(statCards.new) statCards.new.textContent = newCount;
  if(statCards.progress) statCards.progress.textContent = allOrders.filter(o => o.status === 'in_progress' || o.status === 'contacted').length;
  if(statCards.done) statCards.done.textContent = allOrders.filter(o => o.status === 'completed').length;
  if(newBadge){
    newBadge.hidden = !newCount;
    newBadge.textContent = newCount;
  }

  // a live update re-renders every row, so remember which note was being
  // typed in (and where the cursor was) to put the admin back there
  const active = document.activeElement;
  const focusedNote = active && active.classList.contains('order-notes-input')
    ? { id: active.dataset.orderId, start: active.selectionStart, end: active.selectionEnd }
    : null;

  list.innerHTML = '';
  if(!orders.length){
    emptyState.hidden = false;
    emptyState.textContent = allOrders.length ? 'No orders match this filter.' : 'No orders yet — they\'ll show up here as soon as someone submits the form.';
    return;
  }
  emptyState.hidden = true;

  orders.forEach(order => {
    const row = document.createElement('article');
    row.className = 'order-row tilt-card';
    const created = order.created_at ? new Date(order.created_at).toLocaleString() : '—';
    const currentStatus = order.status || 'new';
    const details = order.details || '';
    const isLong = details.length > 280 || details.split('\n').length > 4;
    const expanded = expandedOrders.has(order.id);
    const reply = replyLink(order);
    const phone = phoneDigits(order);
    const savedNotes = order.admin_notes || '';
    const notes = noteDrafts.has(order.id) ? noteDrafts.get(order.id) : savedNotes;

    row.innerHTML = `
      <div class="order-row-main">
        <div class="order-row-top">
          <span class="order-status-badge status-${currentStatus}">${STATUS_LABELS[currentStatus] || currentStatus}</span>
          <span class="order-row-date">${created}</span>
        </div>
        <h3>${escapeHtml(order.name || 'Unnamed')}</h3>
        <p class="order-row-meta">${escapeHtml(order.email || '')}${order.company ? ' · ' + escapeHtml(order.company) : ''}${order.phone ? ' · ' + escapeHtml(order.phone) : ''}</p>
        <div class="order-row-tags">
          ${order.project_type ? `<span>${escapeHtml(order.project_type)}</span>` : ''}
          ${order.budget ? `<span>${escapeHtml(order.budget)}</span>` : ''}
          ${order.timeline ? `<span>${escapeHtml(order.timeline)}</span>` : ''}
        </div>
        <p class="order-row-details${isLong && !expanded ? ' clamped' : ''}">${escapeHtml(details)}</p>
        ${isLong ? `<button type="button" class="order-more-btn" data-order-id="${order.id}">${expanded ? 'Show less' : 'Show full message'}</button>` : ''}
        <div class="order-notes">
          <label for="notes-${order.id}">Private notes</label>
          <textarea id="notes-${order.id}" class="order-notes-input" data-order-id="${order.id}" maxlength="5000" placeholder="Only admins see this — quotes, call notes, next steps…">${escapeHtml(notes)}</textarea>
          <div class="order-notes-foot">
            <button type="button" class="order-notes-save" data-order-id="${order.id}" ${notes === savedNotes ? 'disabled' : ''}>Save note</button>
            <span class="order-notes-status" data-order-id="${order.id}"></span>
          </div>
        </div>
      </div>
      <div class="order-row-actions">
        <label>Status
          <select data-order-id="${order.id}" class="order-status-select">
            ${Object.entries(STATUS_LABELS).map(([val, lab]) => `<option value="${val}" ${val === currentStatus ? 'selected' : ''}>${lab}</option>`).join('')}
          </select>
        </label>
        ${reply ? `<a class="order-contact-btn" href="${escapeHtml(reply)}" data-order-id="${order.id}" data-contact="email">Reply by email</a>` : ''}
        ${phone ? `<a class="order-contact-btn" href="https://wa.me/${phone}" target="_blank" rel="noopener" data-order-id="${order.id}" data-contact="whatsapp">WhatsApp</a>` : ''}
        ${phone ? `<a class="order-contact-btn" href="tel:+${phone}" data-order-id="${order.id}" data-contact="call">Call</a>` : ''}
        <button type="button" class="order-delete-btn" data-order-id="${order.id}">Delete</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.order-status-select').forEach(sel => {
    sel.addEventListener('change', () => updateStatus(sel.dataset.orderId, sel.value));
  });
  list.querySelectorAll('.order-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteOrder(btn.dataset.orderId));
  });
  list.querySelectorAll('.order-more-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.orderId;
      if(expandedOrders.has(id)) expandedOrders.delete(id); else expandedOrders.add(id);
      render();
    });
  });
  // reaching out to a brand-new order moves it to "Contacted"
  list.querySelectorAll('.order-contact-btn').forEach(link => {
    link.addEventListener('click', () => {
      const order = allOrders.find(o => o.id === link.dataset.orderId);
      if(order && (order.status || 'new') === 'new') updateStatus(order.id, 'contacted');
    });
  });
  list.querySelectorAll('.order-notes-input').forEach(input => {
    const id = input.dataset.orderId;
    const saveBtn = list.querySelector(`.order-notes-save[data-order-id="${id}"]`);
    input.addEventListener('input', () => {
      const saved = (allOrders.find(o => o.id === id) || {}).admin_notes || '';
      if(input.value === saved) noteDrafts.delete(id); else noteDrafts.set(id, input.value);
      saveBtn.disabled = input.value === saved;
    });
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveNote(id);
    });
  });
  list.querySelectorAll('.order-notes-save').forEach(btn => {
    btn.addEventListener('click', () => saveNote(btn.dataset.orderId));
  });

  if(focusedNote){
    const input = list.querySelector(`.order-notes-input[data-order-id="${focusedNote.id}"]`);
    if(input){
      input.focus();
      input.setSelectionRange(focusedNote.start, focusedNote.end);
    }
  }
}

async function saveNote(orderId){
  if(!noteDrafts.has(orderId)) return;
  const draft = noteDrafts.get(orderId);
  const statusEl = list.querySelector(`.order-notes-status[data-order-id="${orderId}"]`);
  const btn = list.querySelector(`.order-notes-save[data-order-id="${orderId}"]`);
  if(btn) btn.disabled = true;
  if(statusEl) statusEl.textContent = 'Saving…';
  // dropped before the write: Firestore re-renders from its local copy
  // before updateDoc resolves, and that render should show the saved text
  noteDrafts.delete(orderId);
  try{
    const { db, fs } = await getFirebase();
    await fs.updateDoc(fs.doc(db, 'orders', orderId), { admin_notes: draft.trim() });
    const fresh = list.querySelector(`.order-notes-status[data-order-id="${orderId}"]`);
    if(fresh) fresh.textContent = 'Saved';
  }catch(err){
    console.error('Failed to save note:', err);
    noteDrafts.set(orderId, draft);
    render();
    const el = list.querySelector(`.order-notes-status[data-order-id="${orderId}"]`);
    if(el){
      el.textContent = err.code === 'permission-denied'
        ? 'Not allowed — publish the latest firestore.rules in the Firebase console.'
        : 'Couldn\'t save — please try again.';
      el.classList.add('err');
    }
  }
}

// Downloads the orders currently shown (filter + search) as a CSV file
// that opens cleanly in Excel or Google Sheets.
function exportOrders(){
  const orders = visibleOrders();
  if(!orders.length){
    alert('No orders to export.');
    return;
  }
  const columns = [
    ['created_at', 'Received'], ['status', 'Status'], ['name', 'Name'], ['email', 'Email'],
    ['company', 'Company'], ['phone', 'Phone'], ['project_type', 'Project type'], ['budget', 'Budget'],
    ['timeline', 'Timeline'], ['details', 'Details'], ['admin_notes', 'Notes']
  ];
  const cell = value => {
    let text = String(value == null ? '' : value);
    // stop a spreadsheet treating a submitted value as a formula
    if(/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = [columns.map(([, label]) => cell(label)).join(',')];
  orders.forEach(o => {
    rows.push(columns.map(([key]) => {
      if(key === 'created_at') return cell(o.created_at ? new Date(o.created_at).toLocaleString() : '');
      if(key === 'status') return cell(STATUS_LABELS[o.status || 'new'] || o.status);
      return cell(o[key]);
    }).join(','));
  });
  // the BOM makes Excel read the file as UTF-8 (accents, Arabic names)
  const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devora-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function updateStatus(orderId, status){
  try{
    const { db, fs } = await getFirebase();
    await fs.updateDoc(fs.doc(db, 'orders', orderId), { status });
  }catch(err){
    console.error('Failed to update status:', err);
    alert('Couldn\'t update that order — please try again.');
  }
}

async function deleteOrder(orderId){
  if(!confirm('Delete this order permanently?')) return;
  try{
    const { db, fs } = await getFirebase();
    await fs.deleteDoc(fs.doc(db, 'orders', orderId));
  }catch(err){
    console.error('Failed to delete order:', err);
    alert('Couldn\'t delete that order — please try again.');
  }
}

if(statusFilter) statusFilter.addEventListener('change', render);
if(searchInput) searchInput.addEventListener('input', render);
if(exportBtn) exportBtn.addEventListener('click', exportOrders);

// ---------------------------------------------------------------------
// Tabs (Orders / Projects)
// ---------------------------------------------------------------------
function wireTabs(){
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = {
    orders: document.getElementById('tabOrders'),
    projects: document.getElementById('tabProjects'),
    analytics: document.getElementById('tabAnalytics')
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      Object.entries(panels).forEach(([key, el]) => { if(el) el.hidden = key !== target; });
      // the analytics code and its data load only when the tab is opened
      if(target === 'analytics'){
        import('./admin-analytics.js').then(m => m.initAnalytics(panels.analytics));
      }
    });
  });
}

// ---------------------------------------------------------------------
// Projects — portfolio management
// ---------------------------------------------------------------------
const projectsList = document.getElementById('projectsList');
const projectsEmpty = document.getElementById('projectsEmpty');
const projectForm = document.getElementById('projectForm');
const projectFormTitle = document.getElementById('projectFormTitle');
const projectFormStatus = document.getElementById('projectFormStatus');
const newProjectBtn = document.getElementById('newProjectBtn');
const projectCancelBtn = document.getElementById('projectCancelBtn');
const projectSaveBtn = document.getElementById('projectSaveBtn');
const projectImageInput = document.getElementById('projectImageUrl');
const projectImagePreview = document.getElementById('projectImagePreview');

let allProjects = [];

function wireProjectForm(){
  if(!projectForm) return;

  if(newProjectBtn){
    newProjectBtn.addEventListener('click', () => openProjectForm());
  }
  const importBtn = document.getElementById('importProjectsBtn');
  if(importBtn) importBtn.addEventListener('click', importFeatured);
  if(projectCancelBtn){
    projectCancelBtn.addEventListener('click', () => closeProjectForm());
  }
  if(projectImageInput){
    projectImageInput.addEventListener('input', () => renderImagePreview(projectImageInput.value.trim()));
  }
  projectForm.addEventListener('submit', handleProjectSubmit);
}

function renderImagePreview(url){
  if(!projectImagePreview) return;
  const safe = safeUrl(url);
  projectImagePreview.innerHTML = safe ? `<img src="${escapeHtml(safe)}" alt="">` : '<span>No image yet</span>';
}

function openProjectForm(project){
  projectForm.hidden = false;
  projectFormStatus.textContent = '';
  projectFormStatus.className = 'form-status';
  document.getElementById('projectId').value = project ? project.id : '';
  document.getElementById('projectTitle').value = project ? (project.title || '') : '';
  document.getElementById('projectCategory').value = project ? (project.category || 'websites') : 'websites';
  document.getElementById('projectDescription').value = project ? (project.description || '') : '';
  document.getElementById('projectTags').value = project && Array.isArray(project.tags) ? project.tags.join(', ') : '';
  document.getElementById('projectLiveUrl').value = project ? (project.live_url || '') : '';
  document.getElementById('projectCaseStudyUrl').value = project ? (project.case_study_url || '') : '';
  if(projectImageInput) projectImageInput.value = project ? (project.image_url || '') : '';
  renderImagePreview(project ? (project.image_url || '') : '');
  projectFormTitle.textContent = project ? 'Edit project' : 'Add a project';
  projectForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeProjectForm(){
  projectForm.reset();
  projectForm.hidden = true;
  renderImagePreview('');
}

async function handleProjectSubmit(e){
  e.preventDefault();
  const id = document.getElementById('projectId').value;
  const title = document.getElementById('projectTitle').value.trim();
  const category = document.getElementById('projectCategory').value;
  const description = document.getElementById('projectDescription').value.trim();
  const tags = document.getElementById('projectTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const liveUrl = document.getElementById('projectLiveUrl').value.trim();
  const caseStudyUrl = document.getElementById('projectCaseStudyUrl').value.trim();
  const imageUrl = projectImageInput ? projectImageInput.value.trim() : '';

  if(!title){
    projectFormStatus.textContent = 'Give the project a title.';
    projectFormStatus.className = 'form-status err';
    return;
  }

  projectSaveBtn.disabled = true;
  projectSaveBtn.textContent = 'Saving…';
  projectFormStatus.textContent = '';
  projectFormStatus.className = 'form-status';

  try{
    if(!isConfigured) throw new Error('Firebase config not set yet.');
    const { db, fs } = await getFirebase();
    const data = {
      title, category, description, tags,
      live_url: liveUrl, case_study_url: caseStudyUrl, image_url: imageUrl
    };
    if(id){
      await fs.updateDoc(fs.doc(db, 'projects', id), data);
    }else{
      await fs.addDoc(fs.collection(db, 'projects'), { ...data, created_at: fs.serverTimestamp() });
    }

    closeProjectForm();
  }catch(err){
    console.error('Failed to save project:', err);
    projectFormStatus.textContent = 'Couldn\'t save — ' + (err.message || 'please try again.');
    projectFormStatus.className = 'form-status err';
  }finally{
    projectSaveBtn.disabled = false;
    projectSaveBtn.textContent = 'Save project';
  }
}

async function streamProjects(){
  if(!isConfigured || !projectsList) return;
  try{
    const { db, fs } = await getFirebase();
    const q = fs.query(fs.collection(db, 'projects'), fs.orderBy('created_at', 'desc'));
    fs.onSnapshot(q, snap => {
      allProjects = snap.docs.map(docToObject);
      renderProjects();
    }, err => {
      console.error('Projects load failed:', err);
      if(projectsEmpty){
        projectsEmpty.hidden = false;
        projectsEmpty.textContent = 'Couldn\'t load projects — check your connection and the Firestore security rules.';
      }
    });
  }catch(err){
    console.error('Failed to start projects stream:', err);
  }
}

// Built-in portfolio projects that aren't in the database yet.
function missingFeatured(){
  const have = new Set(allProjects.map(p => normalizeUrl(p.live_url)).filter(Boolean));
  return FEATURED_PROJECTS.filter(f => !have.has(normalizeUrl(f.liveUrl)));
}

function renderImportBanner(){
  const box = document.getElementById('projectsImport');
  if(!box) return;
  // only before the first import: once any of them is in the database,
  // deleting one is a deliberate choice, not something to nag about
  const missing = missingFeatured();
  box.hidden = missing.length < FEATURED_PROJECTS.length;
  if(box.hidden) return;
  document.getElementById('projectsImportText').textContent =
    `${missing.length === FEATURED_PROJECTS.length ? 'Your' : missing.length} portfolio project${missing.length === 1 ? '' : 's'} ` +
    `(${missing.map(m => m.title).join(', ')}) ${missing.length === 1 ? "isn't" : "aren't"} in the database yet, ` +
    `so ${missing.length === 1 ? 'it' : 'they'} can't be edited here. Import once to manage everything from this list.`;
}

async function importFeatured(){
  const btn = document.getElementById('importProjectsBtn');
  const missing = missingFeatured();
  if(!missing.length) return;
  btn.disabled = true;
  btn.textContent = 'Importing…';
  try{
    const { db, fs } = await getFirebase();
    // oldest first, so the first project in the list ends up newest (on top)
    for(const p of [...missing].reverse()){
      await fs.addDoc(fs.collection(db, 'projects'), {
        title: p.title,
        category: p.category,
        description: p.description || '',
        tags: p.tags || [],
        image_url: p.imageUrl || '',
        live_url: p.liveUrl || '',
        case_study_url: p.caseStudyUrl || '',
        created_at: fs.serverTimestamp()
      });
    }
  }catch(err){
    console.error('Import failed:', err);
    alert("Couldn't import the projects — please try again.");
  }finally{
    btn.disabled = false;
    btn.textContent = 'Import them';
  }
}

function renderProjects(){
  if(!projectsList) return;
  renderImportBanner();
  projectsList.innerHTML = '';

  if(!allProjects.length){
    projectsEmpty.hidden = false;
    projectsEmpty.textContent = 'No projects yet — click "Add project" to feature your first one on the portfolio page.';
    return;
  }
  projectsEmpty.hidden = true;

  allProjects.forEach(project => {
    const row = document.createElement('article');
    row.className = 'project-row tilt-card';
    const tags = Array.isArray(project.tags) ? project.tags : [];
    const thumb = safeUrl(project.image_url)
      ? `<img src="${escapeHtml(safeUrl(project.image_url))}" alt="">`
      : `<span>${escapeHtml((project.title || '?').charAt(0).toUpperCase())}</span>`;

    row.innerHTML = `
      <div class="project-row-thumb">${thumb}</div>
      <div class="project-row-main">
        <h3>${escapeHtml(project.title || 'Untitled project')}</h3>
        <p class="project-row-meta">${escapeHtml(CATEGORY_LABELS[project.category] || project.category || '')}${project.description ? ' · ' + escapeHtml(project.description) : ''}</p>
        ${tags.length ? `<div class="project-row-tags">${tags.map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="project-row-actions">
        <button type="button" class="project-edit-btn" data-id="${project.id}">Edit</button>
        <button type="button" class="project-delete-btn" data-id="${project.id}">Delete</button>
      </div>
    `;
    projectsList.appendChild(row);
  });

  projectsList.querySelectorAll('.project-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const project = allProjects.find(p => p.id === btn.dataset.id);
      if(project) openProjectForm(project);
    });
  });
  projectsList.querySelectorAll('.project-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(btn.dataset.id));
  });
}

async function deleteProject(projectId){
  if(!confirm('Delete this project from the portfolio permanently?')) return;
  try{
    const { db, fs } = await getFirebase();
    await fs.deleteDoc(fs.doc(db, 'projects', projectId));
  }catch(err){
    console.error('Failed to delete project:', err);
    alert('Couldn\'t delete that project — please try again.');
  }
}
