// app/api/push/subscribe/route.js
// Saves Web Push (iPhone PWA / Chrome / Edge) and Capacitor FCM device tokens
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'

const supabase = createServiceClient()

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const { subscription, fcm_token, platform = 'web', user_id: bodyUserId } = body

    if (!subscription && !fcm_token) {
      return NextResponse.json({ error: 'Missing subscription or fcm_token' }, { status: 400 })
    }

    let userId = null
    let teamId = null

    // 1. Try standard getRequester
    const requester = await getRequester(req, supabase)
    if (!requester.error && requester.profile?.id) {
      userId = requester.profile.id
      teamId = requester.profile.team_id
    }

    // 2. Fallback: check Authorization Bearer token directly
    if (!userId) {
      const authHeader = req.headers.get('authorization') || ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (token) {
        const { data: authData, error: authErr } = await supabase.auth.getUser(token)
        if (!authErr && authData?.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, team_id')
            .eq('id', authData.user.id)
            .maybeSingle()
          if (prof) {
            userId = prof.id
            teamId = prof.team_id
          }
        }
      }
    }

    // Require valid authentication (never trust arbitrary unverified body user_id)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized to subscribe to push notifications' }, { status: 401 })
    }

    const userAgent = req.headers.get('user-agent') || ''

    if (subscription) {
      // Web Push (iPhone PWA / Chrome / Edge)
      const { endpoint, keys } = subscription
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return NextResponse.json({ error: 'Invalid Web Push subscription format' }, { status: 400 })
      }

      // Check if this endpoint already exists to avoid conflict errors
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', endpoint)
        .maybeSingle()

      let resData = null
      let dbError = null

      if (existing?.id) {
        // Update existing row
        const updateRes = await supabase
          .from('push_subscriptions')
          .update({
            user_id: userId,
            team_id: teamId,
            platform: platform || 'web',
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: userAgent.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .maybeSingle()
        resData = updateRes.data
        dbError = updateRes.error
      } else {
        // Insert new row
        const insertRes = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            team_id: teamId,
            platform: platform || 'web',
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: userAgent.slice(0, 500),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle()
        resData = insertRes.data
        dbError = insertRes.error
      }

      if (dbError) {
        console.warn('[push/subscribe] DB error saving subscription:', dbError.message)
        return NextResponse.json({ ok: false, warning: dbError.message }, { status: 200 })
      }

      return NextResponse.json({ ok: true, subscription_id: resData?.id })
    } else if (fcm_token) {
      // Capacitor Native FCM (Android / iOS app)
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('fcm_token', fcm_token)
        .maybeSingle()

      let resData = null
      let dbError = null

      if (existing?.id) {
        const updateRes = await supabase
          .from('push_subscriptions')
          .update({
            user_id: userId,
            team_id: teamId,
            platform: platform || 'android',
            user_agent: userAgent.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .maybeSingle()
        resData = updateRes.data
        dbError = updateRes.error
      } else {
        const insertRes = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: userId,
            team_id: teamId,
            platform: platform || 'android',
            fcm_token,
            user_agent: userAgent.slice(0, 500),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle()
        resData = insertRes.data
        dbError = insertRes.error
      }

      if (dbError) {
        console.warn('[push/subscribe] DB error saving FCM token:', dbError.message)
        return NextResponse.json({ ok: false, warning: dbError.message }, { status: 200 })
      }

      return NextResponse.json({ ok: true, subscription_id: resData?.id })
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

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (endpoint) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
    } else if (fcm_token) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('fcm_token', fcm_token)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
