begin;

create or replace function public.get_my_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.team_id
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active, true)
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'superadmin'
      and coalesce(p.is_active, true)
  )
$$;

create or replace function public.is_team_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.is_active, true)
  )
$$;

create or replace function public.can_read_team(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
    or (_team_id is not null and _team_id = public.get_my_team_id())
$$;

create or replace function public.can_admin_team(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
    or (
      public.is_team_admin()
      and _team_id is not null
      and _team_id = public.get_my_team_id()
    )
$$;

create or replace function public.set_tenant_team_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.team_id is null then
    new.team_id := public.get_my_team_id();
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_superadmin() then
    return new;
  end if;

  if old.id = auth.uid() then
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
    new.team_id := old.team_id;
    new.is_active := old.is_active;
    new.registration_status := old.registration_status;
    new.approved_at := old.approved_at;
    new.rejection_reason := old.rejection_reason;
    return new;
  end if;

  if public.is_team_admin()
    and old.team_id = public.get_my_team_id()
    and old.role <> 'superadmin'
    and new.role <> 'superadmin' then
    new.id := old.id;
    new.email := old.email;
    new.team_id := old.team_id;
    return new;
  end if;

  raise exception 'not allowed to update this profile';
end;
$$;

grant execute on function public.get_my_team_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_team_admin() to authenticated;
grant execute on function public.can_read_team(uuid) to authenticated;
grant execute on function public.can_admin_team(uuid) to authenticated;

do $$
declare
  target_table text;
  existing_policy record;
  target_tables text[] := array[
    'profiles',
    'teams',
    'athletes',
    'coaches',
    'injuries',
    'training_sessions',
    'performance_stats',
    'contracts',
    'transfers',
    'scouting_reports',
    'staff_logins',
    'subscriptions',
    'billing_events'
  ];
begin
  foreach target_table in array target_tables loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy.policyname, target_table);
    end loop;

    execute format('alter table public.%I enable row level security', target_table);
  end loop;
end $$;

create policy profiles_tenant_select
on public.profiles
for select
to authenticated
using (
  public.is_superadmin()
  or id = auth.uid()
  or public.can_read_team(team_id)
);

create policy profiles_tenant_insert
on public.profiles
for insert
to authenticated
with check (
  public.is_superadmin()
  or (
    id = auth.uid()
    and team_id is null
    and coalesce(role, 'coach') <> 'superadmin'
  )
);

create policy profiles_tenant_update
on public.profiles
for update
to authenticated
using (
  public.is_superadmin()
  or id = auth.uid()
  or public.can_admin_team(team_id)
)
with check (
  public.is_superadmin()
  or id = auth.uid()
  or public.can_admin_team(team_id)
);

create policy profiles_tenant_delete
on public.profiles
for delete
to authenticated
using (public.is_superadmin());

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

create policy teams_tenant_select
on public.teams
for select
to authenticated
using (
  public.is_superadmin()
  or id = public.get_my_team_id()
);

create policy teams_tenant_insert
on public.teams
for insert
to authenticated
with check (public.is_superadmin());

create policy teams_tenant_update
on public.teams
for update
to authenticated
using (
  public.is_superadmin()
  or public.can_admin_team(id)
)
with check (
  public.is_superadmin()
  or public.can_admin_team(id)
);

create policy teams_tenant_delete
on public.teams
for delete
to authenticated
using (public.is_superadmin());

do $$
declare
  target_table text;
  tenant_tables text[] := array[
    'athletes',
    'coaches',
    'injuries',
    'training_sessions',
    'performance_stats',
    'contracts',
    'transfers',
    'scouting_reports'
  ];
begin
  foreach target_table in array tenant_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read_team(team_id))',
      target_table || '_tenant_select',
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_read_team(team_id))',
      target_table || '_tenant_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_read_team(team_id)) with check (public.can_read_team(team_id))',
      target_table || '_tenant_update',
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_read_team(team_id))',
      target_table || '_tenant_delete',
      target_table
    );
  end loop;
end $$;

do $$
declare
  target_table text;
  admin_tables text[] := array[
    'staff_logins',
    'subscriptions',
    'billing_events'
  ];
begin
  foreach target_table in array admin_tables loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read_team(team_id))',
      target_table || '_tenant_select',
      target_table
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.can_admin_team(team_id))',
      target_table || '_tenant_insert',
      target_table
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.can_admin_team(team_id)) with check (public.can_admin_team(team_id))',
      target_table || '_tenant_update',
      target_table
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.can_admin_team(team_id))',
      target_table || '_tenant_delete',
      target_table
    );
  end loop;
end $$;

do $$
declare
  target_table text;
  trigger_tables text[] := array[
    'athletes',
    'coaches',
    'injuries',
    'training_sessions',
    'performance_stats',
    'contracts',
    'transfers',
    'scouting_reports',
    'staff_logins',
    'subscriptions',
    'billing_events'
  ];
begin
  foreach target_table in array trigger_tables loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || target_table || '_team_id', target_table);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.set_tenant_team_id()',
      'set_' || target_table || '_team_id',
      target_table
    );
  end loop;
end $$;

commit;
