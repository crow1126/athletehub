-- Migration: add notification_logs table
-- Tracks SMS notifications sent when schedules are created

create table if not exists public.notification_logs (
  id           uuid         primary key default gen_random_uuid(),
  team_id      uuid         not null references public.teams(id) on delete cascade,
  session_id   uuid         references public.training_sessions(id) on delete set null,
  type         text         not null default 'sms_schedule',  -- sms_schedule | email | push
  sent_count   integer      not null default 0,
  fail_count   integer      not null default 0,
  created_by   uuid         references public.profiles(id) on delete set null,
  created_at   timestamptz  not null default now()
);

-- RLS
alter table public.notification_logs enable row level security;

-- Admins and coaches of the team can view logs
create policy "Team members can view notification logs"
  on public.notification_logs for select
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
    )
  );

-- Only the service role (server) inserts — no direct client inserts
create policy "Service role can insert notification logs"
  on public.notification_logs for insert
  with check (false);  -- blocked for anon/authenticated; service_role bypasses RLS

-- Index for fast lookups
create index if not exists notification_logs_team_id_idx    on public.notification_logs(team_id);
create index if not exists notification_logs_session_id_idx on public.notification_logs(session_id);
create index if not exists notification_logs_created_at_idx on public.notification_logs(created_at desc);
