// app/api/auth/log-access/route.js
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'

const supabase = createServiceClient()

export async function POST(req) {
  try {
    let userId = null
    let teamId = null
    let role = null
    let fullName = null

    // 1. Try standard getRequester
    const requester = await getRequester(req, supabase)
    if (!requester.error && requester.profile?.id) {
      userId = requester.profile.id
      teamId = requester.profile.team_id
      role = requester.profile.role
      fullName = requester.profile.full_name
    }

    // 2. Fallback: check Authorization Bearer token directly with Supabase Auth
    if (!userId) {
      const authHeader = req.headers.get('authorization') || ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (token) {
        const { data: authData, error: authErr } = await supabase.auth.getUser(token)
        if (!authErr && authData?.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, full_name, role, team_id')
            .eq('id', authData.user.id)
            .maybeSingle()
          if (prof) {
            userId = prof.id
            teamId = prof.team_id
            role = prof.role
            fullName = prof.full_name
          }
        }
      }
    }

    // Never trust unauthenticated user_id - must be verified by Supabase Auth JWT
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: valid session required' }, { status: 401 })
    }

    const now = new Date().toISOString()

    // 1. Always update last_login on profile
    await supabase
      .from('profiles')
      .update({ last_login: now })
      .eq('id', userId)

    // 2. Insert audit record in notification_logs (deduplicate within 15 minutes to avoid spamming page refreshes)
    if (teamId) {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { data: recentLog } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('team_id', teamId)
        .eq('created_by', userId)
        .eq('type', 'user_login')
        .gte('created_at', fifteenMinsAgo)
        .limit(1)

      if (!recentLog || recentLog.length === 0) {
        await supabase
          .from('notification_logs')
          .insert({
            team_id: teamId,
            type: 'user_login',
            sent_count: 1,
            fail_count: 0,
            created_by: userId,
          })
      }
    }

    return NextResponse.json({ ok: true, user: fullName, role, last_login: now })
  } catch (err) {
    console.warn('[log-access] Error recording login activity:', err?.message || err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}

