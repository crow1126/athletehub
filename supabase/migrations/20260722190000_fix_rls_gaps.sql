-- Migration: fix rls gaps found in dashboard audit
-- Date: 20260722
-- Issues:
--   1. announcements  — RLS disabled, has USING(true) policy = fully public
--   2. wellness_logs  — RLS disabled, has USING(true) policy = fully public (sensitive medical data)
--   3. ussd_sessions  — RLS enabled but zero policies; service role still works but
--                       leaving it documented clearly
-- notifications, notification_logs — RLS is ON and policies use auth.uid() checks. OK.
-- ussd_sessions — accessed exclusively by service_role (bypasses RLS). OK as-is.

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ANNOUNCEMENTS — enable RLS and scope to team
-- ────────────────────────────────────────────────────────────────────────────

-- Drop the wide-open policy created via Supabase UI
drop policy if exists "Team announcements" on public.announcements;

-- Enable RLS (was disabled)
alter table public.announcements enable row level security;

-- Team members can read their own team's announcements
drop policy if exists announcements_tenant_select on public.announcements;
create policy announcements_tenant_select
  on public.announcements for select
  to authenticated
  using (public.can_read_team(team_id));

-- Only team admins can create/update announcements
drop policy if exists announcements_tenant_insert on public.announcements;
create policy announcements_tenant_insert
  on public.announcements for insert
  to authenticated
  with check (public.can_admin_team(team_id));

drop policy if exists announcements_tenant_update on public.announcements;
create policy announcements_tenant_update
  on public.announcements for update
  to authenticated
  using (public.can_admin_team(team_id))
  with check (public.can_admin_team(team_id));

-- Only team admins can delete announcements
drop policy if exists announcements_tenant_delete on public.announcements;
create policy announcements_tenant_delete
  on public.announcements for delete
  to authenticated
  using (public.can_admin_team(team_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. WELLNESS_LOGS — enable RLS and scope to team (sensitive medical data)
-- ────────────────────────────────────────────────────────────────────────────

-- Drop the wide-open policy created via Supabase UI
drop policy if exists "wellness_policy" on public.wellness_logs;

-- Enable RLS (was disabled)
alter table public.wellness_logs enable row level security;

-- Team members can read wellness logs for their own team
drop policy if exists wellness_logs_tenant_select on public.wellness_logs;
create policy wellness_logs_tenant_select
  on public.wellness_logs for select
  to authenticated
  using (public.can_read_team(team_id));

-- Team members can insert wellness logs for their own team
drop policy if exists wellness_logs_tenant_insert on public.wellness_logs;
create policy wellness_logs_tenant_insert
  on public.wellness_logs for insert
  to authenticated
  with check (public.can_read_team(team_id));

-- Team members can update wellness logs for their own team
drop policy if exists wellness_logs_tenant_update on public.wellness_logs;
create policy wellness_logs_tenant_update
  on public.wellness_logs for update
  to authenticated
  using (public.can_read_team(team_id))
  with check (public.can_read_team(team_id));

-- Only admins can delete wellness logs
drop policy if exists wellness_logs_tenant_delete on public.wellness_logs;
create policy wellness_logs_tenant_delete
  on public.wellness_logs for delete
  to authenticated
  using (public.can_admin_team(team_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. USSD_SESSIONS — document intent; service_role bypasses RLS so USSD
--    webhook continues to work. No authenticated user policies needed.
-- ────────────────────────────────────────────────────────────────────────────
-- Table already has RLS enabled with no policies.
-- service_role key (used by our USSD webhook) bypasses RLS entirely — correct.
-- No anon/authenticated access needed. Current state is intentionally locked.
-- Nothing to change here.

commit;
