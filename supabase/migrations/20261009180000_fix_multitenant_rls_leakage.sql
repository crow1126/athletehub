-- Migration: fix_multitenant_rls_leakage
-- Date: 20261009
-- Fixes critical multi-tenant data leakage risks:
--   1. notices: drops unconstrained "Service role full access on notices" which lacked `to service_role` and granted global access to any authenticated user.
--   2. rehabilitation_notes: drops unconstrained "Service role full access on rehabilitation_notes" which exposed confidential athlete medical/rehab logs across clubs.
--   3. push_subscriptions: drops unconstrained "Service role can manage all push subscriptions" which exposed user device tokens.
-- Note: Supabase service_role possesses Postgres BYPASSRLS privileges natively, so dropping these public policies restores strict tenant isolation while server APIs continue working seamlessly.

begin;

-- 1. notices — ensure only team members and authorized coaches/admins can view/mutate
drop policy if exists "Service role full access on notices" on public.notices;

-- 2. rehabilitation_notes — ensure sensitive medical & physio rehabilitation logs are strictly isolated to club medical staff
drop policy if exists "Service role full access on rehabilitation_notes" on public.rehabilitation_notes;

-- 3. push_subscriptions — ensure users can only view and manage their own push notification credentials
drop policy if exists "Service role can manage all push subscriptions" on public.push_subscriptions;

commit;
