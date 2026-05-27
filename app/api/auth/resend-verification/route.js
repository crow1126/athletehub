import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createEmailVerificationLink } from '@/lib/verificationLink'
import { getAuthCallbackUrl } from '@/lib/siteUrl'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * POST /api/auth/resend-verification
 * Body: { email }
 */
export async function POST(req) {
  try {
    const { email } = await req.json()
    const normalizedEmail = email?.trim()?.toLowerCase()

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const db = getDb()
    const origin = req.headers.get('origin') || new URL(req.url).origin
    const redirectTo = getAuthCallbackUrl(origin)

    const { data: profile } = await db
      .from('profiles')
      .select('id, full_name, club_name, registration_status, is_active')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    // Avoid leaking whether an email exists
    if (!profile) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists for this email, a verification link has been sent.',
      })
    }

    if (profile.is_active && profile.registration_status === 'approved') {
      return NextResponse.json({
        success: true,
        message: 'This account is already active. You can sign in now.',
      })
    }

    const actionLink = await createEmailVerificationLink(db, normalizedEmail, redirectTo)
    if (!actionLink) {
      return NextResponse.json(
        { error: 'Could not generate a verification link. Please contact support.' },
        { status: 500 }
      )
    }

    await fetch(`${SUPABASE_URL}/functions/v1/send-welcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        full_name: profile.full_name || normalizedEmail,
        email: normalizedEmail,
        club_name: profile.club_name,
        action_link: actionLink,
        app_url: origin,
      }),
    })

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Check your inbox and click Confirm Email to activate your account.',
    })
  } catch (err) {
    console.error('Resend verification error:', err)
    return NextResponse.json({ error: err.message || 'Failed to resend verification email.' }, { status: 500 })
  }
}
