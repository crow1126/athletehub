-- Migration: 20260628180000_add_general_indexes.sql
-- Adds indexes on commonly queried columns to speed up multi-tenant queries.
-- Safe to run multiple times (IF NOT EXISTS / do-nothing on duplicate).

begin;

-- profiles: looked up on every authenticated request
create index if not exists idx_profiles_team_id
  on public.profiles(team_id);

create index if not exists idx_profiles_role
  on public.profiles(role);

-- athletes: most list queries filter by team
create index if not exists idx_athletes_team_id
  on public.athletes(team_id);

-- training_sessions: schedule queries filter by team + date range
create index if not exists idx_training_sessions_team_date
  on public.training_sessions(team_id, date);

-- performance_stats: typically queried by athlete_id
create index if not exists idx_performance_stats_athlete
  on public.performance_stats(athlete_id);

-- injuries: listed per team, often filtered by status
create index if not exists idx_injuries_team_status
  on public.injuries(team_id, status);

-- notification_logs: real-time queries per team ordered by created_at
create index if not exists idx_notification_logs_team_created
  on public.notification_logs(team_id, created_at desc)
  where team_id is not null;

-- notifications: ordered feed per team
create index if not exists idx_notifications_team_created
  on public.notifications(team_id, created_at desc)
  where team_id is not null;

-- pay_transactions: wallet history view — team + status
create index if not exists idx_pay_transactions_team_status
  on public.pay_transactions(team_id, status);

-- pay_transactions: webhook lookup by reference
create index if not exists idx_pay_transactions_reference
  on public.pay_transactions(reference);

-- pay_payroll_items: moolre webhook lookup by moolre_ref
create index if not exists idx_pay_payroll_items_moolre_ref
  on public.pay_payroll_items(moolre_ref)
  where moolre_ref is not null;

commit;
