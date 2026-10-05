import { getSupabase, isConfigured } from './supabase-config.js';
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
      if(!isConfigured) throw new Error('Supabase not configured yet.');
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: form.Email.value.trim(),
        password: form.Password.value
      });
      if(error) throw error;
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
  const msg = (err && err.message || '').toLowerCase();
  if(msg.includes('invalid login credentials')) return 'Incorrect email or password.';
  if(msg.includes('email not confirmed')) return 'Please confirm your email address first — check your inbox.';
  if(msg.includes('rate limit')) return 'Too many attempts — please wait a moment and try again.';
  return 'Something went wrong — please try again.';
}
