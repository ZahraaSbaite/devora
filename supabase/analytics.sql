-- ===========================================================================
-- Devora — analytics table
--
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste
-- this whole file -> Run. Safe to re-run.
--
-- Stores anonymous page views and clicks recorded by js/track.js. Nothing
-- personal is kept: no IP address, no cookies, no name or email — just the
-- page, the referring site's domain, a device class, and a random id that
-- lives only for one browser tab (so a "visit" is one tab session).
-- Anyone can add an event; only admins can read them.
-- ===========================================================================

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null check (type in ('pageview', 'click')),
  path text not null check (char_length(path) between 1 and 200),
  label text check (label is null or char_length(label) <= 120),
  referrer text check (referrer is null or char_length(referrer) <= 120),
  session_id text not null check (char_length(session_id) between 8 and 64),
  device text not null check (device in ('mobile', 'tablet', 'desktop'))
);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "anyone can record an analytics event" on public.analytics_events;
create policy "anyone can record an analytics event"
  on public.analytics_events for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins can read analytics" on public.analytics_events;
create policy "admins can read analytics"
  on public.analytics_events for select
  to authenticated
  using (exists (select 1 from public.admins where id = auth.uid()));
-- No update/delete policy: events can't be edited or removed from the
-- client. Clear old rows from the SQL Editor if you ever need to.
