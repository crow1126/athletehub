// scripts/apply_notices_migration.js
// Applies notices table using Supabase Management API (pg endpoint)
const https = require('https')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0]

const sql = `
create table if not exists public.notices (
  id           uuid         primary key default gen_random_uuid(),
  team_id      uuid         not null references public.teams(id) on delete cascade,
  title        text         not null,
  content      text         not null,
  category     text         not null default 'general',
  target_group text         not null default 'all',
  is_pinned    boolean      not null default false,
  author_id    uuid         references public.profiles(id) on delete set null,
  author_name  text,
  author_role  text,
  sms_sent     boolean      not null default false,
  sms_count    integer      not null default 0,
  sms_failed   integer      not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

alter table public.notices enable row level security;

drop policy if exists "Team members can view notices" on public.notices;
create policy "Team members can view notices"
  on public.notices for select
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

drop policy if exists "Admins and coaches can insert notices" on public.notices;
create policy "Admins and coaches can insert notices"
  on public.notices for insert
  with check (team_id in (select team_id from public.profiles where id = auth.uid() and role in ('admin','coach','superadmin')));

drop policy if exists "Admins and coaches can update notices" on public.notices;
create policy "Admins and coaches can update notices"
  on public.notices for update
  using (team_id in (select team_id from public.profiles where id = auth.uid() and role in ('admin','coach','superadmin')));

drop policy if exists "Admins and coaches can delete notices" on public.notices;
create policy "Admins and coaches can delete notices"
  on public.notices for delete
  using (team_id in (select team_id from public.profiles where id = auth.uid() and role in ('admin','coach','superadmin')));

create index if not exists idx_notices_team_created on public.notices(team_id, created_at desc);
create index if not exists idx_notices_team_pinned  on public.notices(team_id, is_pinned desc, created_at desc);
`

const body = JSON.stringify({ query: sql })

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Length': Buffer.byteLength(body),
  }
}

console.log(`Applying migration via Supabase Management API...`)
console.log(`Project: ${projectRef}\n`)

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode)
    console.log('Response:', data)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('\n✅ Migration applied successfully! The notices table is ready.')
    } else {
      console.log('\n❌ Migration failed via Management API.')
      printManualInstructions()
    }
  })
})

req.on('error', (err) => {
  console.error('Request error:', err.message)
  printManualInstructions()
})

function printManualInstructions() {
  console.log('\n=== MANUAL SQL TO RUN IN SUPABASE DASHBOARD ===')
  console.log(`Open: https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  console.log('\n' + sql)
}

req.write(body)
req.end()
