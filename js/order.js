import { getFirebase, isConfigured } from './firebase-config.js';
import { sendOrderNotification } from './email-config.js';

const form = document.getElementById('orderForm');

if(form){
  const status = document.getElementById('formStatus');
  const btn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // honeypot - if filled, silently drop (likely a bot)
    if(form._honey && form._honey.value){
      form.reset();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    status.textContent = '';
    status.className = 'form-status';

    const data = {
      name: form.Name.value.trim(),
      email: form.Email.value.trim(),
      company: form.Company ? form.Company.value.trim() : '',
      phone: form.Phone ? form.Phone.value.trim() : '',
      project_type: form['Project type'].value,
      budget: form.Budget.value,
      timeline: form.Timeline.value.trim(),
      details: form.Details.value.trim(),
      status: 'new',
      source: 'devora-website'
    };

    try{
      if(!isConfigured){
        throw new Error('Firebase config not set yet (js/firebase-config.js still has placeholder values).');
      }

      const { db, fs } = await getFirebase();
      // created_at is stamped by the server, so it can't be backdated
      await fs.addDoc(fs.collection(db, 'orders'), { ...data, created_at: fs.serverTimestamp() });

      // The order is safely saved at this point — a failed notification
      // email should never make it look like the order itself failed (and
      // a visitor shouldn't see internal setup details), so this is only
      // logged to the console for the site owner.
      sendOrderNotification(data);
      // lets the anonymous analytics count a completed order form (js/track.js)
      window.dispatchEvent(new CustomEvent('devora:track', { detail: { type: 'form_submit' } }));

      form.reset();
      status.textContent = 'Order submitted — I\'ll reply within 1–2 business days.';
      status.classList.add('ok');
    }catch(err){
      console.error('Order submission failed:', err);
      status.textContent = 'Order failed — something went wrong. Email devora.inbox@gmail.com directly.';
      status.classList.add('err');
    }finally{
      btn.disabled = false;
      btn.textContent = 'Send order';
    }
  });
}
