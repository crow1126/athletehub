-- Migration: add notifications table
-- User-facing bell notifications for schedule events and SMS reminders

create table if not exists public.notifications (
  id          uuid         primary key default gen_random_uuid(),
  team_id     uuid         not null references public.teams(id) on delete cascade,
  type        text         not null default 'sms_schedule',  -- sms_schedule | sms_reminder
  title       text         not null,
  body        text,
  session_id  uuid         references public.training_sessions(id) on delete set null,
  sent_count  integer      not null default 0,
  read_at     timestamptz,
  created_at  timestamptz  not null default now()
);

-- RLS
alter table public.notifications enable row level security;

-- Team members can view their own team's notifications
create policy "Team members can view notifications"
  on public.notifications for select
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
    )
  );

-- Team members can mark notifications as read (update read_at only)
create policy "Team members can mark notifications read"
  on public.notifications for update
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
    )
  )
  with check (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
    )
  );

-- Only service role inserts (server-side only)
create policy "Service role can insert notifications"
  on public.notifications for insert
  with check (false);  -- blocked for anon/authenticated; service_role bypasses RLS

-- Indexes for fast lookups
create index if not exists notifications_team_id_idx    on public.notifications(team_id);
create index if not exists notifications_session_id_idx on public.notifications(session_id);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notifications_read_at_idx    on public.notifications(read_at) where read_at is null;
