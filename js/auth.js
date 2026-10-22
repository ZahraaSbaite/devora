import { getFirebase, isConfigured } from './firebase-config.js';

// Resolves with the current Firebase user (or null) once auth state is
// known. Firebase reports this through a listener, so wait for its first
// answer. Other modules (contact page gate, admin dashboard) import this so
// they never have to duplicate the session logic.
let authReady = null;
export function onAuthReady(){
  if(!authReady){
    authReady = (async () => {
      if(!isConfigured) return null;
      try{
        const { auth, authApi } = await getFirebase();
        return await new Promise(resolve => {
          const stop = authApi.onAuthStateChanged(auth, user => { stop(); resolve(user); }, () => resolve(null));
        });
      }catch(err){
        console.error('Auth check failed:', err);
        return null;
      }
    })();
  }
  return authReady;
}

// An admin is a user with a document at admins/{uid}. Security rules only
// let a signed-in user read their own admin document, so this never leaks
// the admin list to the client.
export async function isAdmin(user){
  if(!user) return false;
  try{
    const { db, fs } = await getFirebase();
    const snap = await fs.getDoc(fs.doc(db, 'admins', user.uid));
    return snap.exists();
  }catch(err){
    console.error('Admin check failed:', err);
    return false;
  }
}

export async function logout(){
  try{
    const { auth, authApi } = await getFirebase();
    await authApi.signOut(auth);
  }catch(err){
    console.error('Sign out failed:', err);
  }
  window.location.href = 'index.html';
}

function escapeText(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
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
  const label = escapeText(user.displayName || user.email || 'Account');
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
          <span class="nav-account-email">${escapeText(user.email)}</span>
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
