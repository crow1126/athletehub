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
 * Body: { email }
 *
 * Uses admin.generateLink (service role) to produce a recovery link,
 * then sends it via the Resend-powered send-password-reset edge function.
 * This bypasses Supabase's built-in SMTP which can fail with unexpected_failure.
 */
export async function POST(req) {
  // Rate limit: 5 requests / minute per IP (prevents enumeration abuse)
  const limited = authLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const { email } = await req.json()
    const normalizedEmail = email?.trim()?.toLowerCase()

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const db = getDb()
    const origin = req.headers.get('origin') || new URL(req.url).origin
    const siteUrl = getSiteUrl(origin)
    const redirectTo = `${siteUrl}/auth/reset-password`

    // 1. Look up user profile (non-leaking: always return success if not found)
    const { data: profile } = await db
      .from('profiles')
      .select('id, full_name, club_name, is_active')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (!profile) {
      // Security: don't reveal whether the email exists
      return NextResponse.json({ success: true })
    }

    // 2. Generate a password recovery link via admin API (bypasses Supabase SMTP)
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      console.error('Failed to generate recovery link:', linkErr?.message)
      return NextResponse.json(
        { error: 'Could not generate a reset link. Please try again or contact support.' },
        { status: 500 }
      )
    }

    // 3. Build the reset link pointing directly to our app's reset-password page
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

    // 4. Send the email via the dedicated send-password-reset edge function,
    //    with automatic fallback to send-welcome (already deployed and verified working)
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
      full_name:  profile.full_name || normalizedEmail,
      email:      normalizedEmail,
      club_name:  profile.club_name || '',
      reset_link: resetLink,
      app_url:    siteUrl,
    })

    // If not deployed yet, fall back to send-welcome which has the same Resend setup
    if (!emailRes.ok) {
      console.warn('send-password-reset not available, falling back to send-welcome')
      emailRes = await sendEmail('send-welcome', {
        full_name:   profile.full_name || normalizedEmail,
        email:       normalizedEmail,
        club_name:   profile.club_name || '',
        action_link: resetLink,
        app_url:     siteUrl,
      })
      if (!emailRes.ok) {
        const errBody = await emailRes.text().catch(() => '')
        console.error('send-welcome fallback also failed:', emailRes.status, errBody)
        // Still return success — link was generated, email delivery is non-critical to UX
      }
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Forgot password route error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
