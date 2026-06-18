// app/api/cron/sms-reminders/route.js
// Vercel Cron — runs every 5 minutes (*/5 * * * *)
// Finds sessions starting in ~3 hours and sends an SMS reminder to all team athletes

import { NextResponse }                           from 'next/server'
import { createServiceClient }                    from '@/lib/serverAuth'
import { sendBulkSMS, buildReminderSMS }          from '@/lib/moolre'

const supabase = createServiceClient()

// 3-hour window: fire when session is between 2h 55m and 3h 5m away
const WINDOW_LOWER_MIN = 2 * 60 + 55  // 175 minutes
const WINDOW_UPPER_MIN = 3 * 60 + 5   // 185 minutes

export async function GET(req) {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (token !== cronSecret) {
      console.warn('[cron/sms-reminders] Unauthorized request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Compute time window ───────────────────────────────────────────────────
  const now       = new Date()
  const lower     = new Date(now.getTime() + WINDOW_LOWER_MIN * 60 * 1000)
  const upper     = new Date(now.getTime() + WINDOW_UPPER_MIN * 60 * 1000)

  // Build date+time strings in the format stored in Supabase (YYYY-MM-DD and HH:MM)
  function toDateStr(d) {
    return d.toISOString().split('T')[0]
  }
  function toTimeStr(d) {
    return d.toISOString().substring(11, 16) // HH:MM (UTC)
  }

  const lowerDate = toDateStr(lower)
  const upperDate = toDateStr(upper)
  const lowerTime = toTimeStr(lower)
  const upperTime = toTimeStr(upper)

  console.log(`[cron/sms-reminders] Window: ${lowerDate} ${lowerTime} → ${upperDate} ${upperTime}`)

  // ── Fetch sessions in window ──────────────────────────────────────────────
  // We compare date+time as a concatenated text to handle midnight crossover
  const { data: sessions, error: sErr } = await supabase
    .from('training_sessions')
    .select('id, team_id, title, type, date, time, venue, duration')
    .gte('date', lowerDate)
    .lte('date', upperDate)

  if (sErr) {
    console.error('[cron/sms-reminders] Session fetch error:', sErr)
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    console.log('[cron/sms-reminders] No sessions in window')
    return NextResponse.json({ ok: true, processed: 0 })
  }

  // Filter precisely by date+time string comparison
  const lowerKey = `${lowerDate}T${lowerTime}`
  const upperKey = `${upperDate}T${upperTime}`
  const inWindow = sessions.filter(s => {
    const key = `${s.date}T${s.time}`
    return key >= lowerKey && key <= upperKey
  })

  if (inWindow.length === 0) {
    console.log('[cron/sms-reminders] No sessions exactly in window after time filter')
    return NextResponse.json({ ok: true, processed: 0 })
  }

  // ── Process each session ──────────────────────────────────────────────────
  let totalSent    = 0
  let totalFailed  = 0
  let processedIds = []

  for (const session of inWindow) {
    // De-duplicate: skip if we already sent a reminder for this session
    const { data: existing } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('session_id', session.id)
      .eq('type', 'sms_reminder')
      .maybeSingle()

    if (existing) {
      console.log(`[cron/sms-reminders] Already reminded session ${session.id}, skipping`)
      continue
    }

    // Fetch athletes with phones for this team
    const { data: athletes } = await supabase
      .from('athletes')
      .select('id, name, phone')
      .eq('team_id', session.team_id)
      .not('phone', 'is', null)
      .neq('phone', '')

    if (!athletes || athletes.length === 0) {
      console.log(`[cron/sms-reminders] No athletes with phones for team ${session.team_id}`)

      // Still log it to avoid re-processing
      await supabase.from('notification_logs').insert({
        team_id:    session.team_id,
        session_id: session.id,
        type:       'sms_reminder',
        sent_count: 0,
        fail_count: 0,
      })
      // Write bell notification
      await supabase.from('notifications').insert({
        team_id:    session.team_id,
        type:       'sms_reminder',
        title:      session.title,
        body:       `Reminder sent · ${session.type} at ${session.time} — ${session.venue}`,
        session_id: session.id,
        sent_count: 0,
      })
      continue
    }

    // Build recipients
    const recipients = athletes.map(ath => ({
      phone:   ath.phone,
      message: buildReminderSMS({
        athleteName:  ath.name.split(' ')[0],
        sessionTitle: session.title,
        sessionType:  session.type,
        time:         session.time,
        venue:        session.venue,
      }),
    }))

    // Send
    const { sent, failed, error: smsErr } = await sendBulkSMS(recipients)
    console.log(`[cron/sms-reminders] Session ${session.id}: sent=${sent} failed=${failed} ${smsErr || ''}`)

    totalSent   += sent
    totalFailed += failed
    processedIds.push(session.id)

    // Log SMS audit
    await supabase.from('notification_logs').insert({
      team_id:    session.team_id,
      session_id: session.id,
      type:       'sms_reminder',
      sent_count: sent,
      fail_count: failed,
    })

    // Write bell notification
    await supabase.from('notifications').insert({
      team_id:    session.team_id,
      type:       'sms_reminder',
      title:      session.title,
      body:       `3-hour reminder · ${session.type} at ${session.time} — ${session.venue}`,
      session_id: session.id,
      sent_count: sent,
    })
  }

  return NextResponse.json({
    ok: true,
    processed: processedIds.length,
    totalSent,
    totalFailed,
    sessionIds: processedIds,
  })
}
