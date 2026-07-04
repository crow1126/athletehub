import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function POST(req) {
  try {
    const { email } = await req.json()

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    const db = getDb()
    const { data: profile, error } = await db
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (error) {
      console.error('Check email DB error:', error.message)
      return NextResponse.json({ error: 'Database lookup error' }, { status: 500 })
    }

    return NextResponse.json({ exists: !!profile })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
