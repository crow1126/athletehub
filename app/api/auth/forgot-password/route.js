import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter } from '@/lib/rateLimit'
import { getSiteUrl } from '@/lib/siteUrl'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * POST /api/auth/forgot-password
 * Body: { email, identifier }
 *
 * Verifies that the account is actually registered before attempting recovery.
 * Uses admin.generateLink (service role) to produce a recovery link,
 * then sends it via the Resend-powered send-password-reset edge function.
 */
export async function POST(req) {
  // Rate limit: 5 requests / minute per IP (prevents enumeration abuse)
  const limited = await authLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const body = await req.json().catch(() => ({}))
    const rawInput = (body.identifier || body.email || '').trim().toLowerCase()

    if (!rawInput) {
      return NextResponse.json({ error: 'Please enter your registered email address or username.' }, { status: 400 })
    }

    const db = getDb()
    const origin = req.headers.get('origin') || new URL(req.url).origin
    const siteUrl = getSiteUrl(origin)
    const redirectTo = `${siteUrl}/auth/reset-password`

    // 1. Look up user profile by email or username
    let profile = null
    const isEmailInput = rawInput.includes('@')

    if (isEmailInput) {
      const { data: p } = await db
        .from('profiles')
        .select('id, full_name, club_name, email, is_active')
        .ilike('email', rawInput)
        .maybeSingle()
      profile = p
    } else {
      const { data: p } = await db
        .from('profiles')
        .select('id, full_name, club_name, email, is_active')
        .ilike('username', rawInput)
        .maybeSingle()
      profile = p
    }

    // 2. If not found in profiles, check auth.users directly (via generateLink verification)
    let targetEmail = profile?.email || (isEmailInput ? rawInput : null)

    if (!profile) {
      if (!isEmailInput) {
        return NextResponse.json(
          { error: 'No account found with this username. Please check your spelling or contact your administrator.' },
          { status: 404 }
        )
      }

      // Check if user exists in auth.users by attempting to generate a link
      const { data: linkTest, error: linkErrTest } = await db.auth.admin.generateLink({
        type: 'recovery',
        email: rawInput,
        options: { redirectTo },
      })

      if (linkErrTest || !linkTest?.user) {
        return NextResponse.json(
          { error: 'No account found with this email address. Please check your spelling or sign up.' },
          { status: 404 }
        )
      }

      targetEmail = rawInput
      profile = {
        id: linkTest.user.id,
        email: rawInput,
        full_name: linkTest.user.user_metadata?.full_name || rawInput,
        is_active: true,
      }
    }

    // 3. Reject synthetic/internal email addresses (players/staff created without public mailboxes)
    if (
      targetEmail.endsWith('@players.apextrack.internal') ||
      targetEmail.endsWith('@apex.local') ||
      targetEmail.includes('.internal') ||
      targetEmail.includes('.local')
    ) {
      return NextResponse.json(
        { error: 'This account was created by your club administrator without an external email. Please contact your club administrator or coach to reset your password.' },
        { status: 400 }
      )
    }

    // 4. Check if account is active
    if (profile.is_active === false) {
      return NextResponse.json(
        { error: 'This account has been deactivated. Please contact support or your club administrator.' },
        { status: 403 }
      )
    }

    // 5. Generate a password recovery link via admin API (bypasses Supabase SMTP)
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
      options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      if (linkErr?.code === 'user_not_found' || linkErr?.status === 404) {
        return NextResponse.json(
          { error: 'No account found with this email address. Please check your spelling or sign up.' },
          { status: 404 }
        )
      }
      console.error('Failed to generate recovery link:', linkErr?.message)
      return NextResponse.json(
        { error: linkErr?.message || 'Could not generate a reset link. Please try again or contact support.' },
        { status: 500 }
      )
    }

    // 6. Build the reset link pointing directly to our app's reset-password page
    //    (prevents token auto-consumption by email security scanners)
    const raw = linkData.properties.action_link
    let resetLink = raw
    try {
      const urlObj = new URL(raw)
      const tokenHash = urlObj.searchParams.get('token')
      const type      = urlObj.searchParams.get('type') || 'recovery'
      if (tokenHash) {
        resetLink = `${redirectTo}?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`
      }
    } catch {
      // keep raw link as fallback
    }

    // 7. Send the email via the dedicated send-password-reset edge function,
    //    with automatic fallback to send-welcome
    const sendEmail = async (fnName, body) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify(body),
      })
      return res
    }

    // Try send-password-reset first (dedicated branded reset template)
    let emailRes = await sendEmail('send-password-reset', {
      full_name:  profile.full_name || targetEmail,
      email:      targetEmail,
      club_name:  profile.club_name || '',
      reset_link: resetLink,
      app_url:    siteUrl,
    })

    // Fall back to send-welcome if send-password-reset is unavailable
    if (!emailRes.ok) {
      console.warn('send-password-reset not available, falling back to send-welcome')
      emailRes = await sendEmail('send-welcome', {
        full_name:   profile.full_name || targetEmail,
        email:       targetEmail,
        club_name:   profile.club_name || '',
        action_link: resetLink,
        app_url:     siteUrl,
      })
    }

    if (!emailRes.ok) {
      const errBody = await emailRes.text().catch(() => '')
      console.error('Email sending failed:', emailRes.status, errBody)
      return NextResponse.json(
        { error: 'Failed to send recovery email. Please try again later or contact support.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, email: targetEmail })

  } catch (err) {
    console.error('Forgot password route error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
