-- 20260608184000_create_apex_pay_tables.sql
begin;

-- 1. Create Wallets Table
create table if not exists public.pay_wallets (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade unique,
  balance numeric(12, 2) not null default 0.00,
  currency text not null default 'GHS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Create Payroll Runs Table
create table if not exists public.pay_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  status text not null default 'draft', -- draft, pending_approval, approved, processing, completed, failed
  total_amount numeric(12, 2) not null default 0.00,
  currency text not null default 'GHS',
  description text not null,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create Payroll Items Table
create table if not exists public.pay_payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.pay_payroll_runs(id) on delete cascade,
  recipient_type text not null, -- athlete, coach
  recipient_id uuid not null,
  name text not null,
  phone text not null,
  base_salary numeric(12, 2) not null default 0.00,
  bonus numeric(12, 2) not null default 0.00,
  allowance numeric(12, 2) not null default 0.00,
  total_amount numeric(12, 2) not null default 0.00,
  status text not null default 'pending', -- pending, processing, success, failed
  moolre_ref text unique,
  moolre_status_msg text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Create Transactions Table
create table if not exists public.pay_transactions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  wallet_id uuid not null references public.pay_wallets(id) on delete cascade,
  type text not null, -- top_up, payout, fee
  amount numeric(12, 2) not null default 0.00,
  currency text not null default 'GHS',
  status text not null default 'pending', -- pending, processing, success, failed
  reference text not null unique,
  external_ref text,
  payroll_run_id uuid references public.pay_payroll_runs(id) on delete set null,
  payroll_item_id uuid references public.pay_payroll_items(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS) on all tables
alter table public.pay_wallets enable row level security;
alter table public.pay_payroll_runs enable row level security;
alter table public.pay_payroll_items enable row level security;
alter table public.pay_transactions enable row level security;

-- Set up automated team_id triggers for insert
drop trigger if exists set_pay_wallets_team_id on public.pay_wallets;
create trigger set_pay_wallets_team_id before insert on public.pay_wallets for each row execute function public.set_tenant_team_id();

drop trigger if exists set_pay_payroll_runs_team_id on public.pay_payroll_runs;
create trigger set_pay_payroll_runs_team_id before insert on public.pay_payroll_runs for each row execute function public.set_tenant_team_id();

drop trigger if exists set_pay_transactions_team_id on public.pay_transactions;
create trigger set_pay_transactions_team_id before insert on public.pay_transactions for each row execute function public.set_tenant_team_id();

-- Create RLS Policies scoped to can_admin_team (since finance is admin/superadmin only)
-- pay_wallets policies
drop policy if exists pay_wallets_tenant_select on public.pay_wallets;
create policy pay_wallets_tenant_select on public.pay_wallets for select to authenticated using (public.can_admin_team(team_id));

drop policy if exists pay_wallets_tenant_insert on public.pay_wallets;
create policy pay_wallets_tenant_insert on public.pay_wallets for insert to authenticated with check (public.can_admin_team(team_id));

drop policy if exists pay_wallets_tenant_update on public.pay_wallets;
create policy pay_wallets_tenant_update on public.pay_wallets for update to authenticated using (public.can_admin_team(team_id)) with check (public.can_admin_team(team_id));

drop policy if exists pay_wallets_tenant_delete on public.pay_wallets;
create policy pay_wallets_tenant_delete on public.pay_wallets for delete to authenticated using (public.can_admin_team(team_id));

-- pay_payroll_runs policies
drop policy if exists pay_payroll_runs_tenant_select on public.pay_payroll_runs;
create policy pay_payroll_runs_tenant_select on public.pay_payroll_runs for select to authenticated using (public.can_admin_team(team_id));

drop policy if exists pay_payroll_runs_tenant_insert on public.pay_payroll_runs;
create policy pay_payroll_runs_tenant_insert on public.pay_payroll_runs for insert to authenticated with check (public.can_admin_team(team_id));

drop policy if exists pay_payroll_runs_tenant_update on public.pay_payroll_runs;
create policy pay_payroll_runs_tenant_update on public.pay_payroll_runs for update to authenticated using (public.can_admin_team(team_id)) with check (public.can_admin_team(team_id));

drop policy if exists pay_payroll_runs_tenant_delete on public.pay_payroll_runs;
create policy pay_payroll_runs_tenant_delete on public.pay_payroll_runs for delete to authenticated using (public.can_admin_team(team_id));

-- pay_payroll_items policies (scoped via payroll_run_id)
drop policy if exists pay_payroll_items_tenant_select on public.pay_payroll_items;
create policy pay_payroll_items_tenant_select on public.pay_payroll_items for select to authenticated
  using (exists (select 1 from public.pay_payroll_runs r where r.id = payroll_run_id and public.can_admin_team(r.team_id)));

drop policy if exists pay_payroll_items_tenant_insert on public.pay_payroll_items;
create policy pay_payroll_items_tenant_insert on public.pay_payroll_items for insert to authenticated
  with check (exists (select 1 from public.pay_payroll_runs r where r.id = payroll_run_id and public.can_admin_team(r.team_id)));

drop policy if exists pay_payroll_items_tenant_update on public.pay_payroll_items;
create policy pay_payroll_items_tenant_update on public.pay_payroll_items for update to authenticated
  using (exists (select 1 from public.pay_payroll_runs r where r.id = payroll_run_id and public.can_admin_team(r.team_id)))
  with check (exists (select 1 from public.pay_payroll_runs r where r.id = payroll_run_id and public.can_admin_team(r.team_id)));

drop policy if exists pay_payroll_items_tenant_delete on public.pay_payroll_items;
create policy pay_payroll_items_tenant_delete on public.pay_payroll_items for delete to authenticated
  using (exists (select 1 from public.pay_payroll_runs r where r.id = payroll_run_id and public.can_admin_team(r.team_id)));

-- pay_transactions policies
drop policy if exists pay_transactions_tenant_select on public.pay_transactions;
create policy pay_transactions_tenant_select on public.pay_transactions for select to authenticated using (public.can_admin_team(team_id));

drop policy if exists pay_transactions_tenant_insert on public.pay_transactions;
create policy pay_transactions_tenant_insert on public.pay_transactions for insert to authenticated with check (public.can_admin_team(team_id));

drop policy if exists pay_transactions_tenant_update on public.pay_transactions;
create policy pay_transactions_tenant_update on public.pay_transactions for update to authenticated using (public.can_admin_team(team_id)) with check (public.can_admin_team(team_id));

drop policy if exists pay_transactions_tenant_delete on public.pay_transactions;
create policy pay_transactions_tenant_delete on public.pay_transactions for delete to authenticated using (public.can_admin_team(team_id));

commit;
