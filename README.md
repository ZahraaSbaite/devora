# Devora website

The Devora studio site: a full-screen 3D "DEVORA" hero, interactive 3D
studio objects (Three.js), stacked color bands built from the brand palette,
a live portfolio, an order form, and an admin dashboard with orders,
portfolio management and visitor analytics. The backend is Firebase
(Authentication + Cloud Firestore) on the free Spark plan.

## Structure

```
devora-website/
├── index.html          Home — DEVORA hero, services, selected work, process, reasons
├── services.html       One color band per service
├── portfolio.html      Live project grid (built-in projects + admin-added ones)
├── process.html        One color band per step
├── about.html          Name story, team badges, working principles
├── faq.html            Accordion FAQ
├── contact.html        Order form — open to everyone, no account needed
├── login.html / signup.html   Email + password accounts (used for admin access)
├── admin.html          Dashboard: Orders, Projects, Analytics (admins only)
├── privacy.html / terms.html  Template legal pages
├── firestore.rules     Security rules — paste into Firebase (see setup)
├── css/
│   ├── variables.css   Brand colors (Rich Black #0c0c16 background) and type
│   ├── base.css / layout.css / components.css / pages.css / app.css
│   ├── hero.css        Home hero (DEVORA word + 3D scene)
│   ├── depth.css       3D reveals, card depth, footer word, marquee
│   ├── bands.css       Stacked palette bands
│   └── analytics.css   Admin analytics charts
├── js/
│   ├── firebase-config.js   Your Firebase web config + lazy SDK loader
│   ├── auth.js              Session, admin check, nav account menu, logout
│   ├── login.js / signup.js Account pages
│   ├── order.js             Order form → Firestore 'orders'
│   ├── email-config.js      Optional order notification email (EmailJS)
│   ├── projects.js          Built-in + Firestore projects, shared card markup
│   ├── portfolio-render.js / home-projects.js   Render the project grids
│   ├── admin.js             Orders + projects management (live updates)
│   ├── admin-analytics.js   Analytics tab (loaded only when opened)
│   ├── track.js             Anonymous visit tracking on public pages
│   ├── hero-scene.js        Three.js studio objects (home + page headers)
│   ├── hero-word.js         Sizes and tilts the DEVORA word
│   ├── bands.js / depth.js / interact.js / tilt.js / reveal.js   Motion
│   └── nav.js / faq.js
└── assets/             Logo, favicon, assets/work/ project screenshots
```

No build step — it's static HTML/CSS/JS. Push to GitHub and Netlify (or any
static host) serves it as-is.

## Set up Firebase (one time)

1. **Create a project** at [console.firebase.google.com](https://console.firebase.google.com)
   → **Add project**. Google Analytics for the project is optional (the site
   has its own analytics).
2. **Add a web app:** Project overview → the **`</>`** (Web) icon → give it a
   name → **Register app**. Copy the four values from the `firebaseConfig`
   it shows into `js/firebase-config.js`:
   ```js
   export const FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     appId: "1:123...:web:abc..."
   };
   ```
3. **Turn on email/password sign-in:** Build → **Authentication** → Get
   started → **Sign-in method** → **Email/Password** → Enable → Save.
4. **Create the database:** Build → **Firestore Database** → Create database
   → pick a location close to your visitors → start in **production mode**.
5. **Publish the security rules:** Firestore Database → **Rules** → replace
   everything with the contents of `firestore.rules` → **Publish**.
6. **Allow your domain:** Authentication → **Settings** → **Authorized
   domains** → add your live domain (for example `devoratec.netlify.app`).
   `localhost` is already there for local previews.

## Make someone an admin

1. They create an account on `signup.html`.
2. Firebase → **Authentication → Users** → copy that account's **User UID**.
3. Firestore Database → **Data** → **Start collection** (or open `admins`)
   → collection ID `admins` → **Document ID** = the UID → add any field
   (for example `email` = their address) → **Save**.

Repeat for each admin. The site can never create admin documents itself —
only you can, in the console.

## How to open the admin dashboard

Sign in on `login.html`, then open `admin.html` (or use the account menu in
the top-right → **Admin dashboard**). Signed-out visitors get a "Log in"
button; accounts that aren't admins are told they don't have access.

- **Orders** — every brief from `contact.html`, live, with status filtering,
  status changes and delete.
- **Projects** — add, edit or delete portfolio entries. Cover images are a
  link: paste any image URL, or add a screenshot to `assets/work/` and enter
  `assets/work/your-file.jpg`.
- **Analytics** — visits, page views, orders and conversion rate for the
  last 7 / 30 / 90 days (each vs the period before), daily traffic, top
  pages, traffic sources, devices, most-clicked links, and orders by status
  and type. Every chart has a "View as table" option.

Visit tracking (`js/track.js`) is anonymous: no cookies, no IP address,
nothing personal — the page, the referring site's domain, the device type,
and a random id that lasts one browser tab. It's skipped on localhost and
when the browser sends Do Not Track.

## Get an email whenever an order comes in

`js/email-config.js` sends a notification email straight from the browser
right after an order is saved, using [EmailJS](https://www.emailjs.com) (a
free tier is enough for a low-volume order form). No backend to deploy —
same idea as `js/firebase-config.js`.

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

## Notes

- Animations back off for people with "reduce motion" turned on; pointer
  effects are skipped on touch screens.
- The four client projects in `js/projects.js` (`FEATURED_PROJECTS`) always
  show, even before Firebase is set up; admin-added projects appear first.
- Stylesheet and script links carry a `?v=` version tag. Bump it in every
  HTML file when you change CSS or JS, so browsers don't keep old copies.
- `privacy.html` and `terms.html` are template legal pages, not legal
  advice — review them before relying on them.
