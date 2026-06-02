// app/api/schedule/notify/route.js
// Sends SMS notifications to all athletes in a team when a session is scheduled
import { NextResponse }                           from 'next/server'
import { createServiceClient, getRequester }      from '@/lib/serverAuth'
import { sendBulkSMS, buildScheduleSMS }          from '@/lib/moolre'

const supabase = createServiceClient()

export async function POST(req) {
  try {
    const { session_id, team_id } = await req.json()

    if (!session_id || !team_id) {
      return NextResponse.json({ error: 'session_id and team_id required' }, { status: 400 })
    }

    // Auth check
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    // Fetch the session
    const { data: session, error: sErr } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('team_id', team_id)
      .single()

    if (sErr || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Fetch all athletes in this team with a phone number
    const { data: athletes, error: aErr } = await supabase
      .from('athletes')
      .select('id, name, phone')
      .eq('team_id', team_id)
      .not('phone', 'is', null)
      .neq('phone', '')

    if (aErr) {
      return NextResponse.json({ error: aErr.message }, { status: 500 })
    }

    if (!athletes || athletes.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, message: 'No athletes with phone numbers found' })
    }

    // Build SMS for each athlete
    const recipients = athletes.map(ath => ({
      phone:   ath.phone,
      message: buildScheduleSMS({
        athleteName:  ath.name.split(' ')[0], // first name only
        sessionTitle: session.title,
        sessionType:  session.type,
        date:         session.date,
        time:         session.time,
        venue:        session.venue,
        duration:     session.duration,
        notes:        session.notes,
      }),
    }))

    // Send bulk SMS
    const { sent, failed, error: smsError } = await sendBulkSMS(recipients)

    // Log the notification event
    await supabase.from('notification_logs').insert({
      team_id,
      session_id,
      type:       'sms_schedule',
      sent_count: sent,
      fail_count: failed,
      created_by: requester.profile.id,
    }).maybeSingle() // non-blocking — table may not exist yet

    return NextResponse.json({ ok: true, sent, failed, total: athletes.length, smsError: smsError || null })

  } catch (e) {
    console.error('[schedule/notify] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
