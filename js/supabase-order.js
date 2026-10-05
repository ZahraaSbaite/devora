import { getSupabase, isConfigured } from './supabase-config.js';
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
        throw new Error('Supabase config not set yet (js/supabase-config.js still has placeholder values).');
      }

      const supabase = await getSupabase();

      // Optional attachment — uploaded to Storage first so the orders row
      // only ever stores a URL, never the file itself.
      const fileInput = document.getElementById('attachment');
      if(fileInput && fileInput.files && fileInput.files[0]){
        const file = fileInput.files[0];
        if(file.size > 10 * 1024 * 1024){
          throw new Error('Attachment is larger than 10MB.');
        }
        const path = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('order-attachments')
          .upload(path, file);
        if(uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from('order-attachments').getPublicUrl(path);
        data.attachment_url = pub.publicUrl;
        data.attachment_name = file.name;
      }

      const { error } = await supabase.from('orders').insert(data);
      if(error) throw error;

      // The order is safely saved at this point — a failed notification
      // email should never make it look like the order itself failed (and
      // a visitor shouldn't see internal setup details), so this is only
      // logged to the console for the site owner.
      sendOrderNotification(data);

      form.reset();
      status.textContent = 'Order submitted — I\'ll reply within 1–2 business days.';
      status.classList.add('ok');
    }catch(err){
      console.error('Order submission failed:', err);
      status.textContent = err.message && err.message.includes('10MB')
        ? 'Order failed — ' + err.message
        : 'Order failed — something went wrong. Email devora.inbox@gmail.com directly.';
      status.classList.add('err');
    }finally{
      btn.disabled = false;
      btn.textContent = 'Send order';
    }
  });
}
