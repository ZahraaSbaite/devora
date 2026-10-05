# Devora website

A premium, multi-page rebuild of the Devora site: a 3D hero, hover-tilt
cards, a full portfolio with filtering, a technology stack section, an
animated 7-step process timeline, testimonials, an FAQ accordion, and a
Supabase-backed order + portfolio system, plus an admin dashboard to manage
incoming orders and the projects shown on the portfolio page.

## Structure

```
devora-website/
├── index.html            Home — hero, services, why choose us, portfolio teaser,
│                          tech stack, stats, testimonials, process teaser
├── services.html          Full services grid (hover to flip each card)
├── portfolio.html         Filterable project grid (All / Websites / Mobile Apps / UI-UX)
├── process.html           7-step animated horizontal timeline
├── about.html             About us — studio story + team cards
├── faq.html               Accordion FAQ
├── contact.html           Order form (Supabase) — open to everyone
├── login.html             Email/password sign-in (admin access only)
├── signup.html            Email/password account creation
├── admin.html             Order + project management dashboard (admin accounts only)
├── privacy.html           Placeholder privacy policy
├── terms.html             Placeholder terms of service
├── robots.txt / sitemap.xml
├── css/
│   ├── variables.css      Colors, type, spacing (design tokens)
│   ├── base.css            Reset, base type, scroll-reveal utility
│   ├── layout.css          Header, nav, mobile menu, footer
│   ├── components.css      Buttons, cards, forms, sections
│   ├── hero.css            Home hero + code-window mockup
│   ├── pages.css           Per-page tweaks
│   └── app.css              Portfolio, tech stack, why-choose, stats,
│                            testimonials, FAQ, timeline, auth pages, admin
│                            dashboard (orders + projects tabs), nav account
│                            menu, expanded footer
├── js/
│   ├── theme.js              Light/dark toggle (persisted)
│   ├── nav.js                 Scroll header state, mobile menu, active link
│   ├── reveal.js              Scroll-in animations
│   ├── tilt.js                 Pointer-driven 3D tilt on cards
│   ├── code-demo.js             Typewriter code animation in the home hero
│   ├── counter.js               Animated stat counters
│   ├── testimonials.js          Testimonial carousel
│   ├── faq.js                   FAQ accordion
│   ├── supabase-config.js       Your Supabase project URL/key + a shared,
│   │                            lazily-initialized client getter (ES module)
│   ├── auth.js                  Shared auth state, renders the nav's
│   │                            login/account UI, admin check, logout
│   ├── supabase-login.js        login.html logic
│   ├── supabase-signup.js       signup.html logic
│   ├── supabase-order.js        Order form → Supabase 'orders' table, open
│   │                            to everyone, with company/phone/attachment
│   ├── supabase-projects.js     Shared "read projects" module used by
│   │                            portfolio.html and the home page teaser
│   ├── portfolio-render.js      Renders the portfolio page's filter pills
│   │                            + grid from live Supabase data
│   ├── home-projects.js         Renders the home page's 3-project teaser
│   └── admin.js                 admin.html logic — guards the page, streams
│                                 orders AND projects in real time, handles
│                                 status updates/deletes and full project
│                                 CRUD (add/edit/delete + image upload)
├── supabase/
│   └── schema.sql            Run once in the Supabase SQL Editor — creates
│                              the admins/orders/projects tables, Row Level
│                              Security policies, and storage buckets
└── assets/
    ├── logo-mark.png, favicon.png, logo-full.png
```

Nothing here needs a build step — it's static HTML/CSS/JS you can open
directly or drop on any static host (Netlify, Vercel, GitHub Pages,
Cloudflare Pages, etc). Supabase is the backend; no server code to deploy.

## What's in the admin dashboard

Open `admin.html` (or click your account menu → "Admin dashboard" once
logged in) to get two tabs:

- **Orders** — every brief submitted through `contact.html`, in real time,
  with status filtering (New / Contacted / In progress / Completed /
  Archived), inline status updates, and delete.
- **Projects** — click **"+ Add project"** to create a portfolio entry:
  title, category (Websites / Mobile Apps / UI/UX), description, tags, an
  optional cover image (uploaded straight to Supabase Storage), and
  optional live-site / case-study links. Every project you add appears
  immediately on `portfolio.html` under the matching filter pill, and the 3
  most recent show up in the home page's portfolio teaser. Edit or delete
  any project from the same list.

Only accounts you've marked as admins can see this page — everyone else is
redirected to log in.

## Connect it to your Supabase project

1. **Create a project** at [supabase.com](https://supabase.com) if you
   don't have one yet.
2. **Run the schema.** Dashboard → **SQL Editor** → New query → paste the
   entire contents of `supabase/schema.sql` → **Run**. This creates the
   `admins`, `orders`, and `projects` tables with Row Level Security
   policies already locked down, plus two Storage buckets
   (`order-attachments`, `project-images`).
3. **Enable email/password auth** (it's on by default). Dashboard →
   **Authentication → Providers** → make sure **Email** is enabled. While
   you're setting this up, you can also turn **off** "Confirm email" under
   **Authentication → Settings** so your own admin account is active
   immediately after signup — turn it back on later if you want visitors
   who sign up to confirm their email.
4. **Get your API keys.** Dashboard → **Project Settings → API** → copy the
   **Project URL** and the **anon public** key (not `service_role` — that
   one must never go in client code) into `js/supabase-config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```
5. **Make yourself an admin:**
   - Create an account on `signup.html` for yourself (this is the account
     you'll use to log into `admin.html` — not something visitors need).
   - In the Supabase dashboard, go to **Authentication → Users** and copy
     that account's **User UID**.
   - Go to **SQL Editor** and run:
     ```sql
     insert into public.admins (id) values ('paste-the-uid-here');
     ```
   - Log in with that account on `login.html` and open `admin.html` — you
     should see the dashboard. Repeat for any other admin accounts.
6. **Test the flow end to end:** submit an order on `contact.html` (no
   login needed), then log in with your admin account and check it shows
   up in `admin.html` → Orders tab and in **Table Editor → orders** in the
   Supabase dashboard. Then add a project from the **Projects** tab and
   confirm it appears on `portfolio.html`.

## Get an email whenever an order comes in

`js/email-config.js` sends a notification email straight from the browser
right after an order is saved, using [EmailJS](https://www.emailjs.com) (a
free tier is enough for a low-volume order form). No backend to deploy —
same idea as `js/supabase-config.js`.

1. Create a free account at [emailjs.com](https://www.emailjs.com).
2. **Email Services → Add New Service** → connect the inbox that should
   receive notifications (e.g. Gmail) → copy its **Service ID**.
3. **Email Templates → Create New Template**. Use `{{name}}`, `{{email}}`,
   `{{company}}`, `{{phone}}`, `{{project_type}}`, `{{budget}}`,
   `{{timeline}}`, `{{details}}`, `{{source}}` anywhere in the subject/body
   — they're filled in per order. Set the template's "To email" field to
   `{{to_email}}`. Copy the **Template ID**.
4. **Account → General** → copy your **Public Key**.
5. Paste all three into `js/email-config.js`, along with the inbox address
   in `NOTIFY_EMAIL`.

Until those three values are filled in, orders still save to the `orders`
table as normal — the site just skips the email step and logs a warning to
the browser console instead of failing the order.

Want the *customer* to also get an auto-reply confirming their order was
received? EmailJS supports this as a second template + a second
`emailjs.send()` call, or an "Auto-Reply" rule on the same template — ask
and it can be wired in the same way.

## How to open the admin panel

1. Go to `login.html` on your deployed site (or open it locally) and sign
   in with an account you've added to the `admins` table (see step 5
   above). If you haven't created that account yet, go to `signup.html`
   first, then follow step 5 to grant it admin access.
2. Once signed in, either open `admin.html` directly, or click the account
   menu in the top-right of the nav → **"Admin dashboard"**.
3. Use the **Orders** / **Projects** tabs at the top of the dashboard to
   switch between managing incoming briefs and managing the portfolio.

Accounts that aren't in the `admins` table are redirected straight to the
login page if they try to visit `admin.html` — the order form itself stays
open to everyone with no login required.

## Notes

- The home hero's code-window animation, the tilt effect on cards, and all
  scroll/entrance animations back off automatically for people with
  "reduce motion" turned on; the tilt effect is also skipped on touch
  devices.
- Attachment uploads don't require an account (matching the open order
  form) — anyone can upload up to 10MB, and admins can read the file back
  from the dashboard via its download link.
- `portfolio.html` and the home page's portfolio teaser render straight
  from the `projects` table — there's nothing to hand-edit in the HTML
  anymore; manage everything from `admin.html`.
- `about.html` still ships with placeholder team members — edit the
  `.team-card` blocks directly with real names/roles/bios/photos.
- `privacy.html` and `terms.html` are template legal pages, not legal
  advice — review and adjust before relying on them.
- The logo lives in `assets/` — replace any file there by swapping it in;
  no HTML changes needed as long as filenames stay the same.
