-- Migration: storage bucket security policies
-- Date: 20260722
-- Issue #07: Prevent arbitrary bucket enumeration / listing

begin;

-- Ensure athlete-photos bucket exists and is public for reading images,
-- but enforce object-level security policies so public users cannot list bucket contents.
insert into storage.buckets (id, name, public)
values ('athlete-photos', 'athlete-photos', true)
on conflict (id) do update set public = true;

-- Policy 1: Anyone can view/read individual image files (public URLs work)
drop policy if exists "Public Read Access for athlete-photos" on storage.objects;
create policy "Public Read Access for athlete-photos"
  on storage.objects for select
  to public
  using (bucket_id = 'athlete-photos');

-- Policy 2: Only authenticated team members can upload image files
drop policy if exists "Authenticated Insert for athlete-photos" on storage.objects;
create policy "Authenticated Insert for athlete-photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'athlete-photos');

-- Policy 3: Only authenticated team members can update/delete their images
drop policy if exists "Authenticated Update for athlete-photos" on storage.objects;
create policy "Authenticated Update for athlete-photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'athlete-photos')
  with check (bucket_id = 'athlete-photos');

drop policy if exists "Authenticated Delete for athlete-photos" on storage.objects;
create policy "Authenticated Delete for athlete-photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'athlete-photos');

commit;
