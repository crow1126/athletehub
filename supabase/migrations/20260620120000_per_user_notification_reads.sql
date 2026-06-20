-- Migration: per-user notification read state
-- Replaces the shared read_at column on notifications with a per-user junction table.
-- This ensures that marking notifications as read is completely isolated per user —
-- an admin's "Mark all read" action has no effect on coaches or players.

-- ── 1. Create the notification_reads junction table ──────────────────────────
create table if not exists public.notification_reads (
  id               uuid        primary key default gen_random_uuid(),
  notification_id  uuid        not null references public.notifications(id) on delete cascade,
  user_id          uuid        not null references auth.users(id)           on delete cascade,
  read_at          timestamptz not null default now(),

  -- Each user can only read a given notification once
  unique (notification_id, user_id)
);

-- ── 2. Row Level Security ─────────────────────────────────────────────────────
alter table public.notification_reads enable row level security;

-- Users can only see their own read records
create policy "Users can view own notification reads"
  on public.notification_reads for select
  to authenticated
  using (user_id = auth.uid());

-- Users can only insert/upsert their own read records
create policy "Users can mark own notifications read"
  on public.notification_reads for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update their own read records (needed for upsert)
create policy "Users can update own notification reads"
  on public.notification_reads for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own read records (optional, for future "mark unread")
create policy "Users can delete own notification reads"
  on public.notification_reads for delete
  to authenticated
  using (user_id = auth.uid());

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
create index if not exists notification_reads_user_id_idx
  on public.notification_reads(user_id);

create index if not exists notification_reads_notification_id_idx
  on public.notification_reads(notification_id);

-- Composite index for the primary lookup pattern: "which notifications has THIS user read?"
create index if not exists notification_reads_user_notif_idx
  on public.notification_reads(user_id, notification_id);

-- ── 4. Enable Realtime ────────────────────────────────────────────────────────
-- So the bell badge updates live when the user marks notifications read
alter publication supabase_realtime add table public.notification_reads;
