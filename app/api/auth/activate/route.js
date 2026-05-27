import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { activateUserProfile } from '@/lib/activateUser'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * POST /api/auth/activate
 *
 * Secures and activates the profile of a newly verified club admin.
 * Verifies email confirmation with Supabase Auth Admin before activating.
 *
 * Body: { user_id }
 */
export async function POST(req) {
  try {
    const { user_id } = await req.json()

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const db = getDb()
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 })
    }

    const { data: sessionUser, error: sessionErr } = await db.auth.getUser(token)
    if (sessionErr || !sessionUser?.user) {
      return NextResponse.json({ error: 'Invalid or expired verification session.' }, { status: 401 })
    }

    if (sessionUser.user.id !== user_id) {
      return NextResponse.json({ error: 'Forbidden: user mismatch.' }, { status: 403 })
    }

    const result = await activateUserProfile(db, user_id)

    return NextResponse.json({
      success: true,
      message: result.alreadyActive ? 'Account is already active.' : 'Account successfully activated!',
    })
  } catch (err) {
    console.error('Activation route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
