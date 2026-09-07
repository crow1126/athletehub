-- Migration: Add missing columns to push_subscriptions table
-- Adds p256dh, auth (Web Push key material), fcm_token, and user_agent columns
-- Also updates the service_role bypass policy so the API can upsert without RLS blocking it

-- Add p256dh and auth for Web Push encryption
alter table public.push_subscriptions
  add column if not exists p256dh    text,
  add column if not exists auth      text,
  add column if not exists fcm_token text,
  add column if not exists user_agent text;

-- Recreate unique index for fcm_token (may already exist as partial index)
create unique index if not exists idx_push_sub_fcm
  on public.push_subscriptions (user_id, fcm_token)
  where fcm_token is not null;

-- Service role bypass: allow the server (API routes using service role key) to insert/upsert any row
drop policy if exists "Service role can manage all push subscriptions" on public.push_subscriptions;
create policy "Service role can manage all push subscriptions"
  on public.push_subscriptions
  for all
  using (true)
  with check (true);
