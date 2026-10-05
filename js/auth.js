import { getSupabase, isConfigured } from './supabase-config.js';

// Resolves with the current Supabase user (or null) once auth state is
// known. Other modules (contact page gate, admin dashboard) import this so
// they never have to duplicate the session-fetching logic.
export function onAuthReady(){
  return (async () => {
    if(!isConfigured) return null;
    try{
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.getSession();
      if(error){ console.error('Session check failed:', error); return null; }
      return data.session ? data.session.user : null;
    }catch(err){
      console.error('Auth check failed:', err);
      return null;
    }
  })();
}

// Checks the "admins" table for a row whose id === the user's id. RLS only
// lets a signed-in user select their own admin row, so this never leaks the
// full admin list to the client.
export async function isAdmin(user){
  if(!user) return false;
  try{
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if(error){ console.error('Admin check failed:', error); return false; }
    return !!data;
  }catch(err){
    console.error('Admin check failed:', err);
    return false;
  }
}

export async function logout(){
  try{
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  }catch(err){
    console.error('Sign out failed:', err);
  }
  window.location.href = 'index.html';
}

// ---------------------------------------------------------------------
// Nav rendering — runs on every page. Shows "Log in / Sign up" when
// signed out, or an account chip + "Log out" (+ "Admin" if applicable)
// when signed in.
// ---------------------------------------------------------------------
function renderSignedOut(){
  const desktop = document.getElementById('navAuth');
  const mobile = document.getElementById('mobileAuthLinks');
  if(desktop){
    desktop.innerHTML = `<a href="login.html" class="nav-account-link">Log in</a>`;
  }
  if(mobile){
    mobile.innerHTML = `<a href="login.html">Log in</a><a href="signup.html">Sign up</a>`;
  }
}

function renderSignedIn(user, admin){
  const label = (user.user_metadata && user.user_metadata.full_name) || user.email || 'Account';
  const desktop = document.getElementById('navAuth');
  const mobile = document.getElementById('mobileAuthLinks');
  if(desktop){
    desktop.innerHTML = `
      <div class="nav-account" id="navAccountMenu">
        <button type="button" class="nav-account-btn" id="navAccountBtn">
          <span class="nav-account-avatar">${label.charAt(0).toUpperCase()}</span>
          <span class="nav-account-name">${label.split('@')[0]}</span>
        </button>
        <div class="nav-account-drop" id="navAccountDrop">
          <span class="nav-account-email">${user.email || ''}</span>
          ${admin ? '<a href="admin.html">Admin dashboard</a>' : ''}
          <button type="button" id="navLogoutBtn">Log out</button>
        </div>
      </div>`;
    const btn = document.getElementById('navAccountBtn');
    const drop = document.getElementById('navAccountDrop');
    btn.addEventListener('click', () => drop.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if(!desktop.contains(e.target)) drop.classList.remove('open');
    });
    document.getElementById('navLogoutBtn').addEventListener('click', logout);
  }
  if(mobile){
    mobile.innerHTML = `
      <a href="contact.html">Signed in as ${label}</a>
      ${admin ? '<a href="admin.html">Admin dashboard</a>' : ''}
      <a href="#" id="mobileLogoutBtn">Log out</a>`;
    const mLogout = document.getElementById('mobileLogoutBtn');
    if(mLogout) mLogout.addEventListener('click', (e) => { e.preventDefault(); logout(); });
  }
}

(async function initNavAuth(){
  if(!document.getElementById('navAuth') && !document.getElementById('mobileAuthLinks')) return;
  const user = await onAuthReady();
  if(user){
    const admin = await isAdmin(user);
    renderSignedIn(user, admin);
  }else{
    renderSignedOut();
  }
})();
