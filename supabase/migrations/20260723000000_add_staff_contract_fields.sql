-- 20260723_add_staff_contract_fields.sql
-- Adds contract terms fields to the coaches table for the Staff Contracts Dashboard

alter table public.coaches
  add column if not exists monthly_salary  numeric(12,2)   default null,
  add column if not exists win_bonus       numeric(12,2)   default null,
  add column if not exists contract_start  date            default null,
  add column if not exists contract_end    date            default null,
  add column if not exists contract_status text            default 'Active',
  add column if not exists contract_notes  text            default null;

comment on column public.coaches.monthly_salary  is 'Staff monthly gross salary in GHS';
comment on column public.coaches.win_bonus       is 'Per-win / performance bonus amount in GHS';
comment on column public.coaches.contract_start  is 'Contract start date';
comment on column public.coaches.contract_end    is 'Contract end date';
comment on column public.coaches.contract_status is 'Active | Expired | Terminated | Negotiating';
comment on column public.coaches.contract_notes  is 'Optional contract notes or clauses';
