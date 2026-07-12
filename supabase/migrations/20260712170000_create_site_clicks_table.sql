-- Migration: create site_clicks table
-- Tracks visitors who click the site URL, including paths, referrers, and locations

create table if not exists public.site_clicks (
  id           uuid         primary key default gen_random_uuid(),
  url          text         not null,
  referrer     text,
  user_agent   text,
  ip_address   text,
  country      text,
  created_at   timestamptz  not null default now()
);

-- Enable RLS
alter table public.site_clicks enable row level security;

-- Allow public anonymous inserts (so visitors' clicks can be logged without login)
drop policy if exists "Allow public insert to site_clicks" on public.site_clicks;
create policy "Allow public insert to site_clicks" 
  on public.site_clicks for insert 
  with check (true);

-- Allow authenticated superadmins to select clicks
drop policy if exists "Allow superadmin select site_clicks" on public.site_clicks;
create policy "Allow superadmin select site_clicks" 
  on public.site_clicks for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'superadmin'
    )
  );

-- Index for analytics sorting
create index if not exists site_clicks_created_at_idx on public.site_clicks(created_at desc);
