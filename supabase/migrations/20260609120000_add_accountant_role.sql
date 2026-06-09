-- Add 'accountant' as a valid role in the profiles table.
-- If the role column uses a check constraint (not an enum), this alters it.
-- If it uses an enum, this adds the value to the type.

do $$
begin
  -- Handle enum type if it exists
  if exists (
    select 1 from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
      and e.enumlabel = 'accountant'
  ) then
    -- 'accountant' already in enum, nothing to do
    null;
  elsif exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    -- Enum exists but doesn't have 'accountant' yet
    alter type public.user_role add value if not exists 'accountant';
  end if;

  -- Drop any check constraint on profiles.role that excludes 'accountant'
  -- and recreate it with 'accountant' included
  if exists (
    select 1
    from information_schema.check_constraints cc
    join information_schema.constraint_column_usage cu
      on cc.constraint_name = cu.constraint_name
    where cu.table_schema = 'public'
      and cu.table_name = 'profiles'
      and cu.column_name = 'role'
  ) then
    -- Find and drop the constraint
    declare
      constraint_name_val text;
    begin
      select cc.constraint_name into constraint_name_val
      from information_schema.check_constraints cc
      join information_schema.constraint_column_usage cu
        on cc.constraint_name = cu.constraint_name
      where cu.table_schema = 'public'
        and cu.table_name = 'profiles'
        and cu.column_name = 'role'
      limit 1;

      if constraint_name_val is not null then
        execute format('alter table public.profiles drop constraint if exists %I', constraint_name_val);
      end if;
    end;
  end if;
end $$;

-- Ensure the column is text-based and has no conflicting constraint
-- then add a new check constraint including 'accountant'
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'admin', 'coach', 'physio', 'player', 'accountant'));
