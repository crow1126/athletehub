-- Migration: Add gender/sex metrics to athletes, coaches, and teams
alter table public.athletes add column if not exists gender text default 'Male';
alter table public.coaches add column if not exists gender text default 'Male';
alter table public.teams add column if not exists gender_category text default 'Men''s Team';

comment on column public.athletes.gender is 'Athlete sex/gender (Male | Female)';
comment on column public.coaches.gender is 'Staff sex/gender (Male | Female)';
comment on column public.teams.gender_category is 'Club gender category (Men''s Team | Women''s Team | Mixed / Academy)';
