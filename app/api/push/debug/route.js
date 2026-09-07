// app/api/push/debug/route.js
// Diagnostic endpoint: returns current push subscription count for the authenticated user
// Remove or restrict this endpoint before production
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'

const supabase = createServiceClient()

export async function GET(req) {
  try {
    const requester = await getRequester(req, supabase)

    // Count all subscriptions (service role can see all)
    const { data: allSubs, error: allErr } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, platform, endpoint, fcm_token, p256dh, auth, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(20)

    const userId = requester?.profile?.id || null

    // Count user's own subscriptions
    let userSubs = []
    if (userId) {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id, platform, endpoint, fcm_token, created_at')
        .eq('user_id', userId)
      userSubs = data || []
    }

    return NextResponse.json({
      authenticated: !requester.error,
      userId,
      role: requester?.profile?.role,
      teamId: requester?.profile?.team_id,
      totalSubscriptions: allSubs?.length ?? 0,
      userSubscriptions: userSubs.length,
      allSubscriptions: (allSubs || []).map(s => ({
        id: s.id,
        user_id: s.user_id,
        platform: s.platform,
        has_endpoint: !!s.endpoint,
        has_p256dh: !!s.p256dh,
        has_auth: !!s.auth,
        has_fcm: !!s.fcm_token,
        created_at: s.created_at,
        updated_at: s.updated_at,
      })),
      dbError: allErr?.message || null,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
