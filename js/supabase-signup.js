import { getSupabase, isConfigured } from './supabase-config.js';
import { onAuthReady } from './auth.js';

const form = document.getElementById('signupForm');
if(form){
  const status = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

  onAuthReady().then((user) => {
    if(user) window.location.href = redirectTarget();
  });

  function redirectTarget(){
    const params = new URLSearchParams(window.location.search);
    return params.get('redirect') || 'contact.html';
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
      if(!isConfigured) throw new Error('Supabase not configured yet.');
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signUp({
        email: form.Email.value.trim(),
        password: form.Password.value,
        options: form.Name.value.trim() ? { data: { full_name: form.Name.value.trim() } } : undefined
      });
      if(error) throw error;

      // If your Supabase project has "Confirm email" turned on, there's no
      // active session yet — send them to log in after they confirm.
      if(!data.session){
        status.textContent = 'Account created — check your email to confirm it, then log in.';
        status.classList.add('ok');
        btn.disabled = false;
        btn.textContent = 'Create account';
        return;
      }
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
  const msg = (err && err.message || '').toLowerCase();
  if(msg.includes('already registered') || msg.includes('already exists')) return 'An account with that email already exists — try logging in instead.';
  if(msg.includes('password')) return 'Please choose a stronger password.';
  if(msg.includes('email')) return 'That email address doesn\'t look right.';
  return 'Something went wrong — please try again.';
}
