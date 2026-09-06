-- Migration: create push_subscriptions table
-- Supports Web Push (iPhone PWA / Chrome / Edge) and Native FCM (Capacitor Android / iOS)

create table if not exists public.push_subscriptions (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references public.profiles(id) on delete cascade,
  team_id     uuid         references public.teams(id) on delete cascade,
  platform    text         not null default 'web', -- 'web' | 'android' | 'ios'
  endpoint    text,                                -- Web Push endpoint (Safari PWA / Chrome)
  p256dh      text,                                -- Web Push p256dh client key
  auth        text,                                -- Web Push auth secret
  fcm_token   text,                                -- Firebase Cloud Messaging token for Android app
  user_agent  text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- Unique index to prevent duplicate registrations
create unique index if not exists idx_push_sub_web on public.push_subscriptions (user_id, endpoint) where endpoint is not null;
create unique index if not exists idx_push_sub_fcm on public.push_subscriptions (user_id, fcm_token) where fcm_token is not null;

create index if not exists idx_push_sub_team on public.push_subscriptions (team_id);
create index if not exists idx_push_sub_user on public.push_subscriptions (user_id);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Users can view their own subscriptions
drop policy if exists "Users can view own push subscriptions" on public.push_subscriptions;
create policy "Users can view own push subscriptions"
  on public.push_subscriptions for select
  using (user_id = auth.uid());

-- Users can insert their own subscriptions
drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

-- Users can update their own subscriptions
drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions for update
  using (user_id = auth.uid());

-- Users can delete their own subscriptions
drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions for delete
  using (user_id = auth.uid());
