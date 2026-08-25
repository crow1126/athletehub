// scripts/run_migration.js
// Applies the notices table migration directly to Supabase via REST API
const https = require('https')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Extract project ref from URL e.g. https://nivgcxbobofxoszvijhp.supabase.co
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
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
    )
  );

drop policy if exists "Admins and coaches can insert notices" on public.notices;
create policy "Admins and coaches can insert notices"
  on public.notices for insert
  with check (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'coach', 'superadmin')
    )
  );

drop policy if exists "Admins and coaches can update notices" on public.notices;
create policy "Admins and coaches can update notices"
  on public.notices for update
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'coach', 'superadmin')
    )
  );

drop policy if exists "Admins and coaches can delete notices" on public.notices;
create policy "Admins and coaches can delete notices"
  on public.notices for delete
  using (
    team_id in (
      select team_id from public.profiles
      where id = auth.uid()
        and role in ('admin', 'coach', 'superadmin')
    )
  );

create index if not exists idx_notices_team_created on public.notices(team_id, created_at desc);
create index if not exists idx_notices_team_pinned  on public.notices(team_id, is_pinned desc, created_at desc);

alter publication supabase_realtime add table public.notices;
`

const payload = JSON.stringify({ query: sql })

const options = {
  hostname: `${projectRef}.supabase.co`,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
  }
}

console.log('Applying notices table migration via Supabase pg_net...')
console.log('Project:', projectRef)
console.log('Running SQL directly...\n')

// Use Supabase SQL API endpoint
const options2 = {
  hostname: `${projectRef}.supabase.co`,
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
  }
}

// Try via management API - pg endpoint
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function run() {
  try {
    // Try using rpc if available
    const { data, error } = await supabase.rpc('exec_sql', { query: sql })
    if (error) throw error
    console.log('Migration applied via RPC:', data)
  } catch (err) {
    console.log('RPC not available, trying direct table check...')
    
    // Check if table already exists
    const { data, error } = await supabase
      .from('notices')
      .select('id')
      .limit(1)

    if (error && error.code === '42P01') {
      console.error('Table does not exist and we cannot create it without Supabase CLI or management API access.')
      console.log('\n=== MANUAL ACTION REQUIRED ===')
      console.log('Please run this SQL in your Supabase dashboard SQL Editor:')
      console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql/new')
      console.log('\n--- COPY FROM HERE ---')
      console.log(sql)
      console.log('--- COPY TO HERE ---')
    } else if (!error) {
      console.log('Table already exists! You can use it now.')
    } else {
      console.error('Unexpected error:', error)
    }
  }
}

run()
