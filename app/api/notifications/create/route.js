// app/api/notifications/create/route.js
import { NextResponse }                           from 'next/server'
import { createServiceClient, getRequester, canAccessTeam } from '@/lib/serverAuth'

const supabase = createServiceClient()

export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, type, title, body: notifBody } = body

    if (!team_id || !type || !title) {
      return NextResponse.json({ error: 'team_id, type, and title are required' }, { status: 400 })
    }

    // Authenticate user
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    // Verify user can access team
    if (!canAccessTeam(requester.profile, team_id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Insert notification using service client
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        team_id,
        type,
        title,
        body: notifBody,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, notification: data })
  } catch (err) {
    console.error('Notification creation API error:', err)
    return NextResponse.json({ error: err.message || 'Notification creation failed' }, { status: 500 })
  }
}
