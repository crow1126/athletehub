-- Migration: fix notifications realtime
-- Enable realtime for notifications table and optimize RLS policies

-- Drop old policies
drop policy if exists "Team members can view notifications" on public.notifications;
drop policy if exists "Team members can mark notifications read" on public.notifications;

-- Create cleaner policies using standard can_read_team helper
create policy "Team members can view notifications"
  on public.notifications for select
  to authenticated
  using (public.can_read_team(team_id));

create policy "Team members can mark notifications read"
  on public.notifications for update
  to authenticated
  using (public.can_read_team(team_id))
  with check (public.can_read_team(team_id));

-- Enable Realtime for notifications table
alter publication supabase_realtime add table public.notifications;
