import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

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
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')

    if (!username || !username.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    const db = getDb()

    // 1. Look up by username in profiles table
    const { data: profile, error } = await db
      .from('profiles')
      .select('email')
      .ilike('username', username.trim())
      .maybeSingle()

    if (error) {
      console.error('Resolve username DB error:', error.message)
      return NextResponse.json({ error: 'Database lookup error' }, { status: 500 })
    }

    if (!profile || !profile.email) {
      return NextResponse.json({ error: 'Username not found' }, { status: 404 })
    }

    return NextResponse.json({ email: profile.email })
  } catch (err) {
    console.error('Resolve username error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
