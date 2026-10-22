import { getFirebase, isConfigured } from './firebase-config.js';
import { onAuthReady } from './auth.js';

const form = document.getElementById('loginForm');
if(form){
  const status = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

  // Already signed in? Skip straight to where they were headed.
  onAuthReady().then((user) => {
    if(user) window.location.href = redirectTarget();
  });

  function redirectTarget(){
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || 'contact.html';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    status.textContent = '';
    status.className = 'form-status';

    try{
      if(!isConfigured) throw new Error('Firebase not configured yet.');
      const { auth, authApi } = await getFirebase();
      await authApi.signInWithEmailAndPassword(auth, form.Email.value.trim(), form.Password.value);
      window.location.href = redirectTarget();
    }catch(err){
      console.error('Login failed:', err);
      status.textContent = friendlyError(err);
      status.classList.add('err');
      btn.disabled = false;
      btn.textContent = 'Log in';
    }
  });
}

function friendlyError(err){
  const code = (err && err.code) || '';
  if(code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Incorrect email or password.';
  if(code === 'auth/invalid-email') return "That email address doesn't look right.";
  if(code === 'auth/too-many-requests') return 'Too many attempts — please wait a moment and try again.';
  if(code === 'auth/user-disabled') return 'This account has been disabled.';
  if(code === 'auth/network-request-failed') return "Can't reach the account server right now — please try again in a few minutes.";
  return 'Something went wrong — please try again.';
}
