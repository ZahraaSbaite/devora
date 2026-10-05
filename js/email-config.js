// ---------------------------------------------------------------------------
// Email notifications for new orders — powered by EmailJS (emailjs.com),
// so an email can be sent straight from the browser with no backend to
// deploy, matching the no-build-step spirit of the rest of this site.
//
// 1. Create a free account at https://www.emailjs.com
// 2. Email Services -> Add New Service -> connect the inbox that should
//    receive order notifications (e.g. your Gmail) -> copy its Service ID.
// 3. Email Templates -> Create New Template. Use these variables anywhere
//    in the subject/body (double curly braces), they're filled in
//    automatically for every order:
//      {{name}} {{email}} {{company}} {{phone}} {{project_type}}
//      {{budget}} {{timeline}} {{details}} {{source}} {{to_email}}
//    Example subject: "New order from {{name}}"
//    Set the template's "To email" field to {{to_email}} (or hard-code
//    your own inbox there instead). Copy the Template ID.
// 4. Account -> General -> copy your "Public Key".
// 5. Paste all three values below, plus the inbox that should receive the
//    notification.
// ---------------------------------------------------------------------------

export const EMAILJS_PUBLIC_KEY = "Kg02yDmDGwqRUQVVG";
export const EMAILJS_SERVICE_ID = "service_fvhcx3c";
export const EMAILJS_TEMPLATE_ID = "template_asjfgrc";

// Inbox that should receive the "new order" notification.
export const NOTIFY_EMAIL = "devora.inbox@gmail.com";

export const isEmailConfigured =
  EMAILJS_PUBLIC_KEY !== "YOUR_PUBLIC_KEY" &&
  EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID" &&
  EMAILJS_TEMPLATE_ID !== "YOUR_TEMPLATE_ID" &&
  !!EMAILJS_PUBLIC_KEY && !!EMAILJS_SERVICE_ID && !!EMAILJS_TEMPLATE_ID;

let sdkPromise = null;

// Lazily loads the EmailJS browser SDK from CDN once, the same way
// supabase-config.js lazily loads the Supabase SDK.
function loadEmailJs(){
  if(!sdkPromise){
    sdkPromise = import('https://esm.sh/@emailjs/browser@4').then((mod) => {
      const emailjs = mod.default || mod;
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      return emailjs;
    });
  }
  return sdkPromise;
}

// Sends the "new order" notification email. Never throws — a failed
// notification should never make the order submission itself look like
// it failed, since the order is already safely saved in Supabase by the
// time this runs. Callers can still inspect the resolved boolean if they
// want to surface a soft warning.
export async function sendOrderNotification(order){
  if(!isEmailConfigured){
    console.warn('Email notifications not set up yet — see js/email-config.js.');
    return false;
  }
  try{
    const emailjs = await loadEmailJs();
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: NOTIFY_EMAIL,
      name: order.name || '',
      email: order.email || '',
      company: order.company || '—',
      phone: order.phone || '—',
      project_type: order.project_type || '—',
      budget: order.budget || '—',
      timeline: order.timeline || '—',
      details: order.details || '—',
      source: order.source || 'devora-website'
    });
    return true;
  }catch(err){
    console.error('Order notification email failed:', err);
    return false;
  }
}
