import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

// 10 lookups per minute per IP — prevents automated username enumeration
const resolveLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'resolve-username' })

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * GET /api/auth/resolve-username?username=...
 *
 * Looks up the email address associated with a given username (case-insensitive)
 * and returns it. Publicly accessible from the client side login screen.
 */
export async function GET(req) {
  const rl = resolveLimiter(req)
  if (!rl.ok) return rl.response

  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const db = getDb()

    // 1. Look up by username in profiles table
    let { data: profile, error } = await db
      .from('profiles')
      .select('email, is_active')
      .ilike('username', username.trim())
      .maybeSingle()

    if (error) {
      console.error('Resolve username DB error:', error.message)
      return NextResponse.json({ error: 'Database lookup error' }, { status: 500 })
    }

    // 2. Fallback: check staff_logins table
    if (!profile?.email) {
      const { data: staffLogin } = await db
        .from('staff_logins')
        .select('email, is_active')
        .ilike('username', username.trim())
        .maybeSingle()

      if (staffLogin?.email) {
        profile = staffLogin
      }
    }

    // Return 404 for missing OR inactive accounts — don't reveal disabled status
    if (!profile || !profile.email || profile.is_active === false) {
      return NextResponse.json({ error: 'Username not found' }, { status: 404 })
    }

    return NextResponse.json({ email: profile.email })
  } catch (err) {
    console.error('Resolve username error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
