// app/api/schedule/notify/route.js
// Sends immediate SMS notifications when a session is scheduled + writes a bell notification
import { NextResponse }                           from 'next/server'
import { createServiceClient, getRequester }      from '@/lib/serverAuth'
import { sendBulkSMS, buildScheduleSMS }          from '@/lib/moolre'
import { payLimiter }                             from '@/lib/rateLimit'

const supabase = createServiceClient()

export async function POST(req) {
  // Rate limit by IP (10 requests / minute)
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

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

    // ── Multitenancy: enforce requester belongs to the target team ────────────
    const isSuperadmin = requester.profile.role === 'superadmin'
    if (!isSuperadmin && requester.profile.team_id !== team_id) {
      return NextResponse.json({ error: 'Unauthorized: you can only notify athletes in your own team' }, { status: 403 })
    }

    // Fetch the session — always scoped to team_id to prevent cross-team reads
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
      // Still write a bell notification even if no SMS sent
      try {
        const dateStr = new Date(session.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        await supabase.from('notifications').insert({
          team_id,
          type:       'sms_schedule',
          title:      session.title,
          body:       `A ${session.type} session — "${session.title}" — has been scheduled for ${dateStr} at ${session.time} (${session.duration} min) at ${session.venue}. No athlete phone numbers are currently on file.`,
          session_id,
          sent_count: 0,
        })
      } catch (nErr) { console.warn('[notify] notifications insert skipped:', nErr.message) }
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
    const { sent, failed, error: smsError } = await sendBulkSMS(recipients, { teamId: team_id })

    // Log the SMS audit event
    await supabase.from('notification_logs').insert({
      team_id,
      session_id,
      type:       'sms_schedule',
      sent_count: sent,
      fail_count: failed,
      created_by: requester.profile.id,
    }).maybeSingle() // non-blocking — table may not exist yet

    // ── Write a bell notification ───────────────────────────────────────────────────────
    try {
      const dateStr = new Date(session.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      await supabase.from('notifications').insert({
        team_id,
        type:       'sms_schedule',
        title:      session.title,
        body:       `A ${session.type} session — "${session.title}" — has been scheduled for ${dateStr} at ${session.time} (${session.duration} min) at ${session.venue}. ${sent} ${sent === 1 ? 'athlete has' : 'athletes have'} been notified via SMS.`,
        session_id,
        sent_count: sent,
      })
    } catch (nErr) { console.warn('[notify] notifications insert skipped:', nErr.message) }

    return NextResponse.json({ ok: true, sent, failed, total: athletes.length, smsError: smsError || null })

  } catch (e) {
    console.error('[schedule/notify] Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
