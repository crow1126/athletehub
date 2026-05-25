/**
 * One-off: clear all tenant data, keep superadmin auth user + profile.
 * Usage: node scripts/clear-system-data.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPER_ADMIN_EMAIL = 'samuelwobil11@gmail.com'

function loadEnv() {
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {
    /* use existing process.env */
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TABLES = [
  'billing_events',
  'subscriptions',
  'staff_logins',
  'scouting_reports',
  'transfers',
  'contracts',
  'performance_stats',
  'training_sessions',
  'injuries',
  'coaches',
  'athletes',
]

async function main() {
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 })
  const superUser = users?.find(u => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())

  console.log('Before wipe:')
  console.log('  auth users:', users?.length ?? 0)
  console.log('  superadmin:', superUser?.email ?? 'NOT FOUND')

  const { count: profileCount } = await db.from('profiles').select('*', { count: 'exact', head: true })
  console.log('  profiles:', profileCount ?? 0)

  for (const table of TABLES) {
    const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`clear ${table}: ${error.message}`)
    console.log(`  cleared ${table}`)
  }

  const { error: profileError } = await db
    .from('profiles')
    .delete()
    .neq('email', SUPER_ADMIN_EMAIL.toLowerCase())
  if (profileError) throw new Error(`clear profiles: ${profileError.message}`)
  console.log('  cleared non-superadmin profiles')

  const { error: teamError } = await db.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (teamError) throw new Error(`clear teams: ${teamError.message}`)
  console.log('  cleared teams')

  let deletedAuth = 0
  for (const user of users || []) {
    if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) continue
    const { error } = await db.auth.admin.deleteUser(user.id)
    if (!error) deletedAuth++
    else console.warn(`  skip delete ${user.email}: ${error.message}`)
  }
  console.log(`  deleted ${deletedAuth} auth users`)

  // Ensure superadmin profile exists and is correct
  if (superUser) {
    await db.from('profiles').upsert({
      id: superUser.id,
      email: SUPER_ADMIN_EMAIL.toLowerCase(),
      full_name: superUser.user_metadata?.full_name || 'Super Admin',
      role: 'superadmin',
      is_active: true,
      registration_status: 'approved',
      team_id: null,
    }, { onConflict: 'id' })
    console.log('  superadmin profile ensured')
  }

  const { data: afterProfiles } = await db.from('profiles').select('id,email,role')
  const { data: { users: afterUsers } } = await db.auth.admin.listUsers({ perPage: 1000 })

  console.log('\nAfter wipe:')
  console.log('  auth users:', afterUsers?.length ?? 0)
  console.log('  profiles:', afterProfiles?.length ?? 0)
  afterProfiles?.forEach(p => console.log(`    - ${p.email} (${p.role})`))
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
