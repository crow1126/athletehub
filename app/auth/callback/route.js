import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { activateUserProfile } from '@/lib/activateUser'
import { getSiteUrl } from '@/lib/siteUrl'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getServiceDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function getAnonDb() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function redirectToConfirm(request, params) {
  const requestUrl = new URL(request.url)
  const siteUrl = getSiteUrl(requestUrl.origin)
  const url = new URL('/auth/confirm', siteUrl)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url)
}

/**
 * GET /auth/callback
 * Server-side email verification handler for Supabase redirect links.
 */
export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const errorDescription = requestUrl.searchParams.get('error_description')

  if (errorDescription) {
    return redirectToConfirm(request, { error: errorDescription })
  }

  if (!code && !(tokenHash && type)) {
    return redirectToConfirm(request, {
      error: 'Invalid or expired verification link. Request a new one from the login page.',
    })
  }

  try {
    const serviceDb = getServiceDb()
    let userId = null

    if (code) {
      const anonDb = getAnonDb()
      const { data, error } = await anonDb.auth.exchangeCodeForSession(code)
      if (error) throw new Error('Code exchange failed: ' + error.message)
      userId = data?.session?.user?.id || data?.user?.id || null
    } else {
      const anonDb = getAnonDb()
      const { data, error } = await anonDb.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })
      if (error) throw new Error('Token verification failed: ' + error.message)
      userId = data?.session?.user?.id || data?.user?.id || null
    }

    if (!userId) {
      throw new Error('Verification succeeded but no user was found.')
    }

    await activateUserProfile(serviceDb, userId)

    return redirectToConfirm(request, { activated: '1' })
  } catch (err) {
    console.error('Auth callback error:', err)
    return redirectToConfirm(request, { error: err.message || 'Verification failed.' })
  }
}
