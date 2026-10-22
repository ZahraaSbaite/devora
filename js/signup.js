import { getFirebase, isConfigured } from './firebase-config.js';
import { onAuthReady, safeRedirect } from './auth.js';

const form = document.getElementById('signupForm');
if(form){
  const status = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

  onAuthReady().then((user) => {
    if(user) window.location.href = redirectTarget();
  });

  function redirectTarget(){
    const params = new URLSearchParams(window.location.search);
    return safeRedirect(params.get('redirect'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if(form.Password.value.length < 6){
      status.textContent = 'Password needs to be at least 6 characters.';
      status.className = 'form-status err';
      return;
    }
    if(form.Password.value !== form.Confirm.value){
      status.textContent = 'Passwords don\'t match.';
      status.className = 'form-status err';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    status.textContent = '';
    status.className = 'form-status';

    try{
      if(!isConfigured) throw new Error('Firebase not configured yet.');
      const { auth, authApi } = await getFirebase();
      const { user } = await authApi.createUserWithEmailAndPassword(auth, form.Email.value.trim(), form.Password.value);
      const name = form.Name.value.trim();
      if(name) await authApi.updateProfile(user, { displayName: name });
      window.location.href = redirectTarget();
    }catch(err){
      console.error('Sign up failed:', err);
      status.textContent = friendlyError(err);
      status.classList.add('err');
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
}

function friendlyError(err){
  const code = (err && err.code) || '';
  if(code === 'auth/email-already-in-use') return 'An account with that email already exists — try logging in instead.';
  if(code === 'auth/weak-password') return 'Please choose a stronger password (at least 6 characters).';
  if(code === 'auth/invalid-email') return "That email address doesn't look right.";
  if(code === 'auth/operation-not-allowed') return "Sign-ups aren't switched on yet — enable Email/Password in Firebase Authentication.";
  if(code === 'auth/too-many-requests') return 'Too many attempts — please wait a moment and try again.';
  if(code === 'auth/network-request-failed') return "Can't reach the account server right now — please try again in a few minutes.";
  return 'Something went wrong — please try again.';
}
