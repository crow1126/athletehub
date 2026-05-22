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

    // 1. Fetch user auth info via Admin API to verify email confirmation
    const { data: authData, error: authError } = await db.auth.admin.getUserById(user_id)

    if (authError || !authData?.user) {
      console.error('Error fetching user auth info:', authError?.message)
      return NextResponse.json({ error: 'Verification failed: User auth record not found.' }, { status: 404 })
    }

    const user = authData.user

    // 2. Check if email is confirmed
    const isEmailConfirmed = !!(user.email_confirmed_at || user.confirmed_at)
    if (!isEmailConfirmed) {
      return NextResponse.json({ error: 'Please confirm your email address before activating your account.' }, { status: 400 })
    }

    // 3. Check current profile state
    const { data: profile, error: profileGetError } = await db
      .from('profiles')
      .select('registration_status, is_active')
      .eq('id', user_id)
      .maybeSingle()

    if (profileGetError || !profile) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }

    // If already active/approved, just succeed
    if (profile.is_active && profile.registration_status === 'approved') {
      return NextResponse.json({ success: true, message: 'Account is already active.' })
    }

    // 4. Update profile to active / approved
    const { error: updateError } = await db
      .from('profiles')
      .update({
        is_active: true,
        registration_status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', user_id)

    if (updateError) {
      console.error('Failed to activate profile:', updateError.message)
      return NextResponse.json({ error: 'Failed to activate profile: ' + updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Account successfully activated!',
    })
  } catch (err) {
    console.error('Activation route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
