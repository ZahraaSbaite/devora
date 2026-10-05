import { getSupabase, isConfigured } from './supabase-config.js';
import { onAuthReady, isAdmin, logout } from './auth.js';
import { CATEGORY_LABELS, escapeHtml } from './supabase-projects.js';

const gate = document.getElementById('adminGate');
const panel = document.getElementById('adminPanel');
const list = document.getElementById('ordersList');
const emptyState = document.getElementById('ordersEmpty');
const statusFilter = document.getElementById('statusFilter');
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

let allOrders = [];

(async function init(){
  const user = await onAuthReady();
  if(!user){
    showGate('Please log in with an admin account to view orders.', true);
    return;
  }
  const admin = await isAdmin(user);
  if(!admin){
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
// Orders — realtime via Supabase Postgres Changes. We keep one in-memory
// list (allOrders) and re-fetch + re-render whenever the table changes,
// which is simpler and just as fast as patching individual rows for a
// dashboard of this size.
// ---------------------------------------------------------------------
async function streamOrders(){
  if(!isConfigured) return;
  try{
    const supabase = await getSupabase();
    await reloadOrders(supabase);

    supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => reloadOrders(supabase))
      .subscribe();
  }catch(err){
    console.error('Failed to start orders stream:', err);
  }
}

async function reloadOrders(supabase){
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if(error){
    console.error('Orders load failed:', error);
    if(emptyState){
      emptyState.hidden = false;
      emptyState.textContent = 'Couldn\'t load orders — check your connection and Supabase RLS policies.';
    }
    return;
  }
  allOrders = data || [];
  render();
}

function render(){
  const filter = statusFilter ? statusFilter.value : 'all';
  const orders = filter === 'all' ? allOrders : allOrders.filter(o => (o.status || 'new') === filter);

  if(statCards.total) statCards.total.textContent = allOrders.length;
  if(statCards.new) statCards.new.textContent = allOrders.filter(o => (o.status || 'new') === 'new').length;
  if(statCards.progress) statCards.progress.textContent = allOrders.filter(o => o.status === 'in_progress' || o.status === 'contacted').length;
  if(statCards.done) statCards.done.textContent = allOrders.filter(o => o.status === 'completed').length;

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
        <p class="order-row-details">${escapeHtml(order.details || '')}</p>
        ${order.attachment_url ? `<a href="${order.attachment_url}" target="_blank" rel="noopener" class="order-attachment-link">📎 ${escapeHtml(order.attachment_name || 'Attachment')}</a>` : ''}
      </div>
      <div class="order-row-actions">
        <label>Status
          <select data-order-id="${order.id}" class="order-status-select">
            ${Object.entries(STATUS_LABELS).map(([val, lab]) => `<option value="${val}" ${val === currentStatus ? 'selected' : ''}>${lab}</option>`).join('')}
          </select>
        </label>
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
}

async function updateStatus(orderId, status){
  try{
    const supabase = await getSupabase();
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if(error) throw error;
  }catch(err){
    console.error('Failed to update status:', err);
    alert('Couldn\'t update that order — please try again.');
  }
}

async function deleteOrder(orderId){
  if(!confirm('Delete this order permanently?')) return;
  try{
    const supabase = await getSupabase();
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if(error) throw error;
  }catch(err){
    console.error('Failed to delete order:', err);
    alert('Couldn\'t delete that order — please try again.');
  }
}

if(statusFilter) statusFilter.addEventListener('change', render);

// ---------------------------------------------------------------------
// Tabs (Orders / Projects)
// ---------------------------------------------------------------------
function wireTabs(){
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = { orders: document.getElementById('tabOrders'), projects: document.getElementById('tabProjects') };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      Object.entries(panels).forEach(([key, el]) => { if(el) el.hidden = key !== target; });
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
const projectImageInput = document.getElementById('projectImage');
const projectImagePreview = document.getElementById('projectImagePreview');

let allProjects = [];
let editingImageUrl = '';

function wireProjectForm(){
  if(!projectForm) return;

  if(newProjectBtn){
    newProjectBtn.addEventListener('click', () => openProjectForm());
  }
  if(projectCancelBtn){
    projectCancelBtn.addEventListener('click', () => closeProjectForm());
  }
  if(projectImageInput){
    projectImageInput.addEventListener('change', () => {
      const file = projectImageInput.files && projectImageInput.files[0];
      if(!file){
        renderImagePreview(editingImageUrl);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => { projectImagePreview.innerHTML = `<img src="${reader.result}" alt="">`; };
      reader.readAsDataURL(file);
    });
  }
  projectForm.addEventListener('submit', handleProjectSubmit);
}

function renderImagePreview(url){
  if(!projectImagePreview) return;
  projectImagePreview.innerHTML = url ? `<img src="${url}" alt="">` : '<span>No image selected</span>';
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
  if(projectImageInput) projectImageInput.value = '';
  editingImageUrl = project ? (project.image_url || '') : '';
  renderImagePreview(editingImageUrl);
  projectFormTitle.textContent = project ? 'Edit project' : 'Add a project';
  projectForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeProjectForm(){
  projectForm.reset();
  projectForm.hidden = true;
  editingImageUrl = '';
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
    if(!isConfigured) throw new Error('Supabase config not set yet.');
    const supabase = await getSupabase();

    let imageUrl = editingImageUrl;
    const file = projectImageInput && projectImageInput.files && projectImageInput.files[0];
    if(file){
      if(file.size > 10 * 1024 * 1024) throw new Error('Image is larger than 10MB.');
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('project-images').upload(path, file);
      if(uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('project-images').getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }

    const data = {
      title, category, description, tags,
      live_url: liveUrl, case_study_url: caseStudyUrl, image_url: imageUrl
    };

    const { error } = id
      ? await supabase.from('projects').update(data).eq('id', id)
      : await supabase.from('projects').insert(data);
    if(error) throw error;

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
    const supabase = await getSupabase();
    await reloadProjects(supabase);

    supabase
      .channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => reloadProjects(supabase))
      .subscribe();
  }catch(err){
    console.error('Failed to start projects stream:', err);
  }
}

async function reloadProjects(supabase){
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if(error){
    console.error('Projects load failed:', error);
    if(projectsEmpty){
      projectsEmpty.hidden = false;
      projectsEmpty.textContent = 'Couldn\'t load projects — check your connection and Supabase RLS policies.';
    }
    return;
  }
  allProjects = data || [];
  renderProjects();
}

function renderProjects(){
  if(!projectsList) return;
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
    const thumb = project.image_url
      ? `<img src="${project.image_url}" alt="">`
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
    const supabase = await getSupabase();
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if(error) throw error;
  }catch(err){
    console.error('Failed to delete project:', err);
    alert('Couldn\'t delete that project — please try again.');
  }
}
