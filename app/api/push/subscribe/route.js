// app/api/push/subscribe/route.js
// Saves Web Push (iPhone PWA / Chrome) and Capacitor FCM device tokens
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'

const supabase = createServiceClient()

export async function POST(req) {
  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const userId = requester.profile?.id
    const teamId = requester.profile?.team_id
    if (!userId) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 400 })
    }

    const body = await req.json()
    const { subscription, fcm_token, platform = 'web' } = body

    if (!subscription && !fcm_token) {
      return NextResponse.json({ error: 'Missing subscription or fcm_token' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') || ''

    if (subscription) {
      // Web Push (iPhone PWA / Chrome / Edge)
      const { endpoint, keys } = subscription
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return NextResponse.json({ error: 'Invalid Web Push subscription format' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            team_id: teamId,
            platform: platform || 'web',
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: userAgent.slice(0, 500),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        )
        .select()
        .maybeSingle()

      if (error) {
        console.warn('[push/subscribe] DB error saving subscription:', error.message)
        // If table doesn't exist yet, return ok: false with hint
        return NextResponse.json({ ok: false, warning: error.message }, { status: 200 })
      }

      return NextResponse.json({ ok: true, subscription_id: data?.id })
    } else if (fcm_token) {
      // Capacitor Native FCM (Android / iOS app)
      const { data, error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: userId,
            team_id: teamId,
            platform: platform || 'android',
            fcm_token,
            user_agent: userAgent.slice(0, 500),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,fcm_token' }
        )
        .select()
        .maybeSingle()

      if (error) {
        console.warn('[push/subscribe] DB error saving FCM token:', error.message)
        return NextResponse.json({ ok: false, warning: error.message }, { status: 200 })
      }

      return NextResponse.json({ ok: true, subscription_id: data?.id })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe] Unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const userId = requester.profile?.id
    const { endpoint, fcm_token } = await req.json().catch(() => ({}))

    let query = supabase.from('push_subscriptions').delete().eq('user_id', userId)
    if (endpoint) query = query.eq('endpoint', endpoint)
    if (fcm_token) query = query.eq('fcm_token', fcm_token)

    await query
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
