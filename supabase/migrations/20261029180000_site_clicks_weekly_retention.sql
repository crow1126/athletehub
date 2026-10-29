-- Migration: site_clicks weekly retention + higher sequence count
-- Keep clicks for 8 weeks (56 days); sequential ordering; count beyond 100

-- 1. Increase the limit: no hard cap, but add a managed cleanup function
--    that only deletes records OLDER than 56 days (8 weeks), not on every insert.

-- 2. Add a sequence_number column for ordered display
alter table public.site_clicks
  add column if not exists sequence_number bigserial;

-- Create an index on sequence for fast sequential reads
create index if not exists site_clicks_sequence_idx on public.site_clicks(sequence_number asc);

-- 3. Weekly cleanup function: called manually or via a pg_cron schedule.
--    Deletes clicks older than 56 days (8 weeks). Does NOT delete recent data.
create or replace function public.cleanup_old_site_clicks()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.site_clicks
  where created_at < now() - interval '56 days';
end;
$$;

-- 4. Grant superadmin (service role) permission to call cleanup
-- (called from the superadmin API, not automatically on insert)
revoke all on function public.cleanup_old_site_clicks() from public;
grant execute on function public.cleanup_old_site_clicks() to service_role;
