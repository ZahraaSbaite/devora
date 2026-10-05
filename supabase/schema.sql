-- ===========================================================================
-- Devora — Supabase schema
--
-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New
-- query -> paste this whole file -> Run. It creates the tables, Row Level
-- Security (RLS) policies, and storage buckets the site needs.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / DROP POLICY IF
-- EXISTS guards, so running it twice won't error.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. admins — marks which auth users are allowed into admin.html.
--    You add rows here yourself (see the README), never from the client.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

drop policy if exists "admins can read their own row" on public.admins;
create policy "admins can read their own row"
  on public.admins for select
  to authenticated
  using (auth.uid() = id);
-- No insert/update/delete policy is defined, so the table can only be
-- written to from the SQL Editor / dashboard (which use the service role
-- and bypass RLS) — never from client-side code.

-- ---------------------------------------------------------------------------
-- 2. orders — every brief submitted through contact.html.
--    Anyone can create one (no account needed); only admins can read,
--    update, or delete.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  phone text,
  project_type text,
  budget text,
  timeline text,
  details text,
  status text not null default 'new',
  source text,
  attachment_url text,
  attachment_name text,
  created_at timestamptz not null default now(),
  constraint orders_name_len check (char_length(name) > 0 and char_length(name) < 200),
  constraint orders_email_len check (char_length(email) > 0 and char_length(email) < 200),
  constraint orders_details_len check (details is null or char_length(details) < 5000)
);

alter table public.orders enable row level security;

drop policy if exists "anyone can submit an order" on public.orders;
create policy "anyone can submit an order"
  on public.orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins can read orders" on public.orders;
create policy "admins can read orders"
  on public.orders for select
  to authenticated
  using (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admins can update orders" on public.orders;
create policy "admins can update orders"
  on public.orders for update
  to authenticated
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admins can delete orders" on public.orders;
create policy "admins can delete orders"
  on public.orders for delete
  to authenticated
  using (exists (select 1 from public.admins where id = auth.uid()));

-- Realtime, so the admin dashboard updates live as orders come in.
alter publication supabase_realtime add table public.orders;

-- ---------------------------------------------------------------------------
-- 3. projects — the portfolio. Public can read (so the site can display
--    it); only admins can add, edit, or delete.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('websites', 'mobile', 'uiux')),
  description text,
  tags text[] not null default '{}',
  image_url text,
  live_url text,
  case_study_url text,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "anyone can read projects" on public.projects;
create policy "anyone can read projects"
  on public.projects for select
  to anon, authenticated
  using (true);

drop policy if exists "admins can insert projects" on public.projects;
create policy "admins can insert projects"
  on public.projects for insert
  to authenticated
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admins can update projects" on public.projects;
create policy "admins can update projects"
  on public.projects for update
  to authenticated
  using (exists (select 1 from public.admins where id = auth.uid()))
  with check (exists (select 1 from public.admins where id = auth.uid()));

drop policy if exists "admins can delete projects" on public.projects;
create policy "admins can delete projects"
  on public.projects for delete
  to authenticated
  using (exists (select 1 from public.admins where id = auth.uid()));

alter publication supabase_realtime add table public.projects;

-- ---------------------------------------------------------------------------
-- 4. Storage buckets — order attachments and portfolio cover images.
--    Both are marked "public" so getPublicUrl() links work like Firebase's
--    getDownloadURL() did; write access is still locked down by policy.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('order-attachments', 'order-attachments', true, 10485760)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-images', 'project-images', true, 10485760)
on conflict (id) do nothing;

drop policy if exists "anyone can upload order attachments" on storage.objects;
create policy "anyone can upload order attachments"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'order-attachments');

drop policy if exists "anyone can read order attachments" on storage.objects;
create policy "anyone can read order attachments"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'order-attachments');

drop policy if exists "admins can manage project images" on storage.objects;
create policy "admins can manage project images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'project-images'
    and exists (select 1 from public.admins where id = auth.uid())
  )
  with check (
    bucket_id = 'project-images'
    and exists (select 1 from public.admins where id = auth.uid())
  );

drop policy if exists "anyone can read project images" on storage.objects;
create policy "anyone can read project images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'project-images');
