-- Migration: add physiotherapy plans and clinical diagnosis data
-- Sports Injury Diagnosis and Rehabilitation Plan (Individual Physiotherapy Report)
-- Confidential clinical data managed by Physiotherapy and Medical staff

-- 1. Ensure JSONB columns exist on rehabilitation_notes and injuries
alter table public.rehabilitation_notes
  add column if not exists physio_plan jsonb;

alter table public.injuries
  add column if not exists diagnosis_data jsonb;

-- 2. Create dedicated physiotherapy_plans table for comprehensive clinical records
create table if not exists public.physiotherapy_plans (
  id            uuid         primary key default gen_random_uuid(),
  team_id       uuid         not null references public.teams(id) on delete cascade,
  athlete_id    uuid         not null references public.athletes(id) on delete cascade,
  injury_id     uuid         references public.injuries(id) on delete set null,
  report_date   date         not null default CURRENT_DATE,
  plan_data     jsonb        not null default '{}'::jsonb,
  author_id     uuid         references public.profiles(id) on delete set null,
  author_name   text,
  author_role   text         default 'physio',
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- Enable RLS
alter table public.physiotherapy_plans enable row level security;

-- SELECT Policy: Medical staff and Club Admins belonging to the same team
drop policy if exists "Medical staff and admins can view physiotherapy plans" on public.physiotherapy_plans;
create policy "Medical staff and admins can view physiotherapy plans"
  on public.physiotherapy_plans for select
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and (
          role in ('superadmin', 'admin', 'physio')
          or id in (
            select user_id from public.coaches
            where staff_type in ('physio', 'sports_scientist', 'medical')
          )
        )
    )
  );

-- INSERT Policy: Only Physios / Medical Staff can insert physiotherapy plans
drop policy if exists "Only physios can insert physiotherapy plans" on public.physiotherapy_plans;
create policy "Only physios can insert physiotherapy plans"
  on public.physiotherapy_plans for insert
  with check (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and (
          role in ('physio', 'superadmin')
          or id in (
            select user_id from public.coaches
            where staff_type in ('physio', 'sports_scientist', 'medical')
          )
        )
    )
  );

-- UPDATE Policy: Only Physios / Medical Staff can update physiotherapy plans
drop policy if exists "Only physios can update physiotherapy plans" on public.physiotherapy_plans;
create policy "Only physios can update physiotherapy plans"
  on public.physiotherapy_plans for update
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and (
          role in ('physio', 'superadmin')
          or id in (
            select user_id from public.coaches
            where staff_type in ('physio', 'sports_scientist', 'medical')
          )
        )
    )
  );

-- DELETE Policy: Only Club Admins & Physios can delete
drop policy if exists "Only physios and admins can delete physiotherapy plans" on public.physiotherapy_plans;
create policy "Only physios and admins can delete physiotherapy plans"
  on public.physiotherapy_plans for delete
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and (
          role in ('physio', 'admin', 'superadmin')
          or id in (
            select user_id from public.coaches
            where staff_type in ('physio', 'sports_scientist', 'medical')
          )
        )
    )
  );

-- Indexes for performance
create index if not exists idx_physio_plans_team_athlete on public.physiotherapy_plans(team_id, athlete_id, report_date desc);
create index if not exists idx_physio_plans_injury on public.physiotherapy_plans(injury_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- REQUIRED as of Supabase October 30 2026:
-- New tables in "public" no longer receive automatic Data API access.
-- Explicit GRANTs must be added in the same migration that creates each table.
-- RLS policies above still enforce row-level isolation.
-- ─────────────────────────────────────────────────────────────────────────────

-- anon: read-only (RLS blocks unauthenticated access anyway)
grant select
  on public.physiotherapy_plans
  to anon;

-- authenticated users: full CRUD (RLS policies above scope to authorised roles only)
grant select, insert, update, delete
  on public.physiotherapy_plans
  to authenticated;

-- service_role: unrestricted server-side access for API routes / edge functions
grant select, insert, update, delete
  on public.physiotherapy_plans
  to service_role;
