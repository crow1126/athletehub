-- Add 'accountant' as a valid staff type in the coaches table check constraint.
alter table public.coaches
  drop constraint if exists coaches_staff_type_check;

alter table public.coaches
  add constraint coaches_staff_type_check
  check (staff_type in (
    'head_coach', 'assistant_coach', 'fitness_coach',
    'physio', 'sports_scientist', 'medical',
    'analyst', 'scout', 'kit_manager', 'other', 'accountant'
  ));
