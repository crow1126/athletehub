-- Migration: team-scoped storage bucket policies for athlete-photos
-- Date: 20260813
-- Issue: any authenticated user could upload/delete photos for athletes of other teams.
-- Fix: scope insert/update/delete to the uploader's own team by enforcing a
--      path convention of  {team_id}/{filename}  and verifying the team_id prefix
--      matches the caller's team via get_my_team_id().

begin;

-- ── HELPER: extract team_id from storage object name ────────────────────────
-- Objects must be stored as  {team_id}/{filename}  (any depth after team_id is fine)
-- e.g.  "abc123/photo.jpg"  or  "abc123/subfolder/photo.png"

-- Drop and recreate scoped upload policy
drop policy if exists "Authenticated Insert for athlete-photos" on storage.objects;
create policy "Authenticated Insert for athlete-photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'athlete-photos'
    and (
      -- Allow if the first path segment is the caller's own team_id
      split_part(name, '/', 1)::uuid = public.get_my_team_id()
      -- Superadmins bypass the team check
      or public.is_superadmin()
    )
  );

-- Drop and recreate scoped update policy
drop policy if exists "Authenticated Update for athlete-photos" on storage.objects;
create policy "Authenticated Update for athlete-photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'athlete-photos'
    and (
      split_part(name, '/', 1)::uuid = public.get_my_team_id()
      or public.is_superadmin()
    )
  )
  with check (
    bucket_id = 'athlete-photos'
    and (
      split_part(name, '/', 1)::uuid = public.get_my_team_id()
      or public.is_superadmin()
    )
  );

-- Drop and recreate scoped delete policy
drop policy if exists "Authenticated Delete for athlete-photos" on storage.objects;
create policy "Authenticated Delete for athlete-photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'athlete-photos'
    and (
      split_part(name, '/', 1)::uuid = public.get_my_team_id()
      or public.is_superadmin()
    )
  );

-- Public read stays wide open — individual URLs are unguessable UUIDs
-- No change needed for the SELECT policy.

commit;
