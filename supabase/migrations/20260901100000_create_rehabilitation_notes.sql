-- Migration: create rehabilitation_notes table
-- Confidential clinical notes managed exclusively by Team Physios / Medical Staff
-- Read-only visibility for Club Admins / Superadmins
-- Hidden from coaches, analysts, scouts, players, and other staff

create table if not exists public.rehabilitation_notes (
  id                  uuid         primary key default gen_random_uuid(),
  team_id             uuid         not null references public.teams(id) on delete cascade,
  athlete_id          uuid         not null references public.athletes(id) on delete cascade,
  injury_id           uuid         references public.injuries(id) on delete set null,
  session_date        date         not null default CURRENT_DATE,
  rehab_phase         text         not null default 'Phase 1 - Acute Protection',
  pain_level          integer      not null default 0 check (pain_level >= 0 and pain_level <= 10),
  treatment_summary   text         not null,
  clinical_notes      text         not null,
  target_milestone    text,
  clearance_status    text         not null default 'In Rehab',
  author_id           uuid         references public.profiles(id) on delete set null,
  author_name         text,
  author_role         text         default 'physio',
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- Enable RLS
alter table public.rehabilitation_notes enable row level security;

-- SELECT Policy: Only Physios, Medical Staff, Admins, and Superadmins belonging to the same team
drop policy if exists "Physios and admins can view rehabilitation notes" on public.rehabilitation_notes;
create policy "Physios and admins can view rehabilitation notes"
  on public.rehabilitation_notes for select
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

-- INSERT Policy: Only Physios / Medical Staff can insert rehabilitation notes
drop policy if exists "Only physios can insert rehabilitation notes" on public.rehabilitation_notes;
create policy "Only physios can insert rehabilitation notes"
  on public.rehabilitation_notes for insert
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

-- UPDATE Policy: Only Physios / Medical Staff can update rehabilitation notes
drop policy if exists "Only physios can update rehabilitation notes" on public.rehabilitation_notes;
create policy "Only physios can update rehabilitation notes"
  on public.rehabilitation_notes for update
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

-- DELETE Policy: Only Physios / Medical Staff can delete rehabilitation notes
drop policy if exists "Only physios can delete rehabilitation notes" on public.rehabilitation_notes;
create policy "Only physios can delete rehabilitation notes"
  on public.rehabilitation_notes for delete
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

-- Service role bypass
drop policy if exists "Service role full access on rehabilitation_notes" on public.rehabilitation_notes;
create policy "Service role full access on rehabilitation_notes"
  on public.rehabilitation_notes for all
  using (true)
  with check (true);

-- Indexes for performance
create index if not exists idx_rehab_notes_team_athlete on public.rehabilitation_notes(team_id, athlete_id, session_date desc);
create index if not exists idx_rehab_notes_injury on public.rehabilitation_notes(injury_id);

-- Realtime
alter publication supabase_realtime add table public.rehabilitation_notes;
