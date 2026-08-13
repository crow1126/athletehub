-- Migration: fix_role_constraints_and_pay_rls
-- Date: 20260813
-- Issues fixed:
--   1. profiles.role check constraint missing 'analyst' and 'scout'
--   2. pay_* tables use can_admin_team() which excludes 'accountant' role —
--      accountants can access /pay UI but get empty results from DB

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ADD analyst + scout TO profiles.role CONSTRAINT
-- ────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'superadmin',
    'admin',
    'coach',
    'physio',
    'player',
    'accountant',
    'analyst',
    'scout'
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. CREATE can_access_pay() FUNCTION — extends can_admin_team() to include accountant
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.can_access_pay(_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
    or (
      _team_id is not null
      and _team_id = public.get_my_team_id()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('admin', 'accountant')
          and coalesce(p.is_active, true)
      )
    )
$$;

grant execute on function public.can_access_pay(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. REPLACE pay_* RLS POLICIES — use can_access_pay() for SELECT,
--    keep can_admin_team() for mutating ops (only admins can run payroll / top up)
-- ────────────────────────────────────────────────────────────────────────────

-- pay_wallets
drop policy if exists pay_wallets_tenant_select on public.pay_wallets;
create policy pay_wallets_tenant_select
  on public.pay_wallets for select
  to authenticated
  using (public.can_access_pay(team_id));

-- pay_payroll_runs
drop policy if exists pay_payroll_runs_tenant_select on public.pay_payroll_runs;
create policy pay_payroll_runs_tenant_select
  on public.pay_payroll_runs for select
  to authenticated
  using (public.can_access_pay(team_id));

-- pay_payroll_items — scoped via parent run
drop policy if exists pay_payroll_items_tenant_select on public.pay_payroll_items;
create policy pay_payroll_items_tenant_select
  on public.pay_payroll_items for select
  to authenticated
  using (
    exists (
      select 1 from public.pay_payroll_runs r
      where r.id = payroll_run_id
        and public.can_access_pay(r.team_id)
    )
  );

-- pay_transactions
drop policy if exists pay_transactions_tenant_select on public.pay_transactions;
create policy pay_transactions_tenant_select
  on public.pay_transactions for select
  to authenticated
  using (public.can_access_pay(team_id));

commit;
