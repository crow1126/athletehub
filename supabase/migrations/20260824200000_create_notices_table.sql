-- Migration: create notices table
-- Team Notice Board for Coaches and Admins with Moolre SMS broadcast capability

create table if not exists public.notices (
  id           uuid         primary key default gen_random_uuid(),
  team_id      uuid         not null references public.teams(id) on delete cascade,
  title        text         not null,
  content      text         not null,
  category     text         not null default 'general', -- 'general' | 'urgent' | 'matchday' | 'training' | 'medical'
  target_group text         not null default 'all',     -- 'all' | 'players' | 'staff' | 'goalkeepers' | 'defenders' | 'midfielders' | 'forwards'
  is_pinned    boolean      not null default false,
  author_id    uuid         references public.profiles(id) on delete set null,
  author_name  text,
  author_role  text,
  sms_sent     boolean      not null default false,
  sms_count    integer      not null default 0,
  sms_failed   integer      not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Enable RLS
alter table public.notices enable row level security;

-- Team members (players, coaches, staff, admins) can view their own team's notices
drop policy if exists "Team members can view notices" on public.notices;
create policy "Team members can view notices"
  on public.notices for select
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
    )
  );

-- Admins and coaches can create notices
drop policy if exists "Admins and coaches can insert notices" on public.notices;
create policy "Admins and coaches can insert notices"
  on public.notices for insert
  with check (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'coach', 'superadmin')
    )
  );

-- Admins and coaches can update notices
drop policy if exists "Admins and coaches can update notices" on public.notices;
create policy "Admins and coaches can update notices"
  on public.notices for update
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'coach', 'superadmin')
    )
  );

-- Admins and coaches can delete notices
drop policy if exists "Admins and coaches can delete notices" on public.notices;
create policy "Admins and coaches can delete notices"
  on public.notices for delete
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'coach', 'superadmin')
    )
  );

-- Service role bypass
drop policy if exists "Service role full access on notices" on public.notices;
create policy "Service role full access on notices"
  on public.notices for all
  using (true)
  with check (true);

-- Indexes for performance
create index if not exists idx_notices_team_created on public.notices(team_id, created_at desc);
create index if not exists idx_notices_team_pinned  on public.notices(team_id, is_pinned desc, created_at desc);

-- Realtime
alter publication supabase_realtime add table public.notices;
