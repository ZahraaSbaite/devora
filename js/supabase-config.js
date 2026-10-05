// ---------------------------------------------------------------------------
// Supabase project configuration.
//
// Get these values from: Supabase dashboard -> Project Settings -> API.
// - SUPABASE_URL is your "Project URL".
// - SUPABASE_ANON_KEY is the "anon public" key (NOT the service_role key —
//   that one must never appear in client-side code).
//
// Both values are safe to keep client-side. Access is controlled by the
// Row Level Security (RLS) policies in /supabase/schema.sql, not by keeping
// these secret.
// ---------------------------------------------------------------------------
export const SUPABASE_URL = "https://bmnrcaqjtwtwglnvytfq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbnJjYXFqdHd0d2dsbnZ5dGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDk0MTYsImV4cCI6MjA5OTYyNTQxNn0.85blbZqn7GIV110IMOBWMWzFmLiApW43e_eixYe47YQ";

// True once someone has swapped in real project values above.
export const isConfigured =
  SUPABASE_URL !== "https://YOUR-PROJECT-REF.supabase.co" &&
  SUPABASE_ANON_KEY !== "YOUR-ANON-PUBLIC-KEY" &&
  !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

let clientPromise = null;

// Lazily loads the Supabase JS SDK from CDN and returns a shared client
// instance, so every module (auth, orders, projects) reuses the same
// connection rather than creating a new one per call.
export function getSupabase(){
  if(!clientPromise){
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  }
  return clientPromise;
}
