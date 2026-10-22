// ---------------------------------------------------------------------------
// Firebase project configuration.
//
// Get these values from: Firebase console -> Project settings (gear icon) ->
// General -> "Your apps" -> the web app (</>) -> SDK setup and configuration
// -> "Config". Paste the four values below.
//
// These values are safe to keep in client-side code. Access to data is
// controlled by the security rules in firestore.rules, not by keeping the
// config secret.
// ---------------------------------------------------------------------------
export const FIREBASE_CONFIG = {
  apiKey: "YOUR-API-KEY",
  authDomain: "YOUR-PROJECT-ID.firebaseapp.com",
  projectId: "YOUR-PROJECT-ID",
  appId: "YOUR-APP-ID"
};

// True once someone has swapped in real project values above.
export const isConfigured =
  !FIREBASE_CONFIG.apiKey.startsWith('YOUR-') &&
  !FIREBASE_CONFIG.projectId.startsWith('YOUR-');

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2';
let firebasePromise = null;

// Lazily loads the Firebase SDK (app, auth, firestore) from Google's CDN and
// returns one shared set of clients, so every module reuses the same
// connection. `authApi` and `fs` are the SDK modules, for their functions
// (signInWithEmailAndPassword, collection, query, ...).
export function getFirebase(){
  if(!firebasePromise){
    firebasePromise = Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`)
    ]).then(([appApi, authApi, fs]) => {
      const app = appApi.initializeApp(FIREBASE_CONFIG);
      return { auth: authApi.getAuth(app), db: fs.getFirestore(app), authApi, fs };
    });
  }
  return firebasePromise;
}

// Turns a Firestore document into a plain object with its id, converting
// Firestore Timestamps to ISO strings so the rest of the site works with
// ordinary dates.
export function docToObject(snap){
  const out = { id: snap.id };
  Object.entries(snap.data()).forEach(([key, value]) => {
    out[key] = value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value;
  });
  return out;
}
