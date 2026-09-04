-- Migration: Team custom Moolre VAS SMS key and sender ID
-- Allows clubs (such as Young Apostles FC) to have custom SMS header and VAS packages,
-- while other clubs default to system Apextrack Moolre SMS gateway.

alter table public.teams add column if not exists moolre_vas_key text;
alter table public.teams add column if not exists sms_sender_id text;

-- Seed custom SMS package for Young Apostles FC
update public.teams
set 
  moolre_vas_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2YXNpZCI6MTMxMjAsImV4cCI6MTk1NjUyNzk5OX0.woIRGPdPX01MihjwzGViTKijuJLhOgxjOtLyOGCw2q4',
  sms_sender_id = 'YAFC'
where id = '324cd849-5c62-4278-9594-97e606439402' or ilike(name, '%young apostle%');

-- Seed custom SMS package for Kotoko SC
update public.teams
set 
  moolre_vas_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ2YXNpZCI6MTMxMzEsImV4cCI6MTk1NjUyNzk5OX0.AuQ_4R20t69fqvZf7fNY63v9JUmpoetfC4fZ90IiE0c',
  sms_sender_id = 'KOTOKO SC'
where id = '99801a63-c7ba-474d-a664-86de133ff054' or ilike(name, '%kotoko%');

comment on column public.teams.moolre_vas_key is 'Club-specific Moolre VAS SMS API Key (JWT). Falls back to MOOLRE_VAS_KEY if null.';
comment on column public.teams.sms_sender_id is 'Custom alphanumeric SMS sender header (up to 11 chars) registered with Moolre for this club. Falls back to MOOLRE_SMS_SENDER_ID if null.';
