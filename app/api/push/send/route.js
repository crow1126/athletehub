// app/api/push/send/route.js
// Triggers Web Push and Native notifications to team members or users
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'
import { dispatchPushToTeam, dispatchPushToUser } from '@/lib/serverPush'

const supabase = createServiceClient()

export async function POST(req) {
  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const { team_id, user_id, title, body, url, tag } = await req.json()

    const targetTeamId = team_id || requester.profile?.team_id

    // Check authority: user must be coach, admin, or superadmin
    const userRole = requester.profile?.role
    if (!['admin', 'coach', 'superadmin', 'manager'].includes(userRole)) {
      return NextResponse.json({ error: 'Unauthorized to send push notifications' }, { status: 403 })
    }

    if (user_id) {
      const result = await dispatchPushToUser(user_id, { title, body, url, tag })
      return NextResponse.json({ ok: true, result })
    }

    if (targetTeamId) {
      const result = await dispatchPushToTeam(targetTeamId, { title, body, url, tag })
      return NextResponse.json({ ok: true, result })
    }

    return NextResponse.json({ error: 'Missing team_id or user_id' }, { status: 400 })
  } catch (err) {
    console.error('[push/send] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
