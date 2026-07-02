// app/api/performance/publish-notify/route.js
// Publishes all unnotified performance stats for a team as a single
// team-wide notification. Called by the analyst when they are done
// entering all players' stats for the session.

import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canAccessTeam } from '@/lib/serverAuth'
import { sanitizeUUID } from '@/lib/sanitize'
import log from '@/lib/logger'

const db = createServiceClient()

export async function POST(req) {
  try {
    const body = await req.json()
    const team_id = sanitizeUUID(body.team_id)

    if (!team_id) {
      return NextResponse.json({ error: 'Valid team_id is required' }, { status: 400 })
    }

    // Auth
    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canAccessTeam(requester.profile, team_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all unnotified performance stats for this team
    const { data: unpublished, error: fetchErr } = await db
      .from('performance_stats')
      .select('id, match_date, opponent, rating, athletes(name, position)')
      .eq('team_id', team_id)
      .eq('notified', false)
      .order('match_date', { ascending: false })

    if (fetchErr) {
      log.error('publish-notify fetch failed', { team_id, error: fetchErr.message })
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!unpublished || unpublished.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, message: 'No unpublished stats to notify' })
    }

    // Build the notification message
    const playerCount = unpublished.length

    // Get unique match dates to mention
    const dates = [...new Set(unpublished.map(s => s.match_date))].sort()
    const dateStr = dates.map(d =>
      new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    ).join(', ')

    // Get opponent(s) — use most recent entry's opponent
    const opponent = unpublished[0]?.opponent || null

    const notifTitle = `📊 Performance Stats Published`
    const notifBody = opponent
      ? `New performance stats have been published for the match on ${dateStr} vs ${opponent}.`
      : `New performance stats have been published for ${dateStr}.`

    // Insert one team-wide notification
    const { error: notifErr } = await db
      .from('notifications')
      .insert({
        team_id,
        type: 'performance',
        title: notifTitle,
        body: notifBody,
      })

    if (notifErr) {
      log.error('publish-notify insert failed', { team_id, error: notifErr.message })
      return NextResponse.json({ error: notifErr.message }, { status: 500 })
    }

    // Mark all those rows as notified
    const ids = unpublished.map(s => s.id)
    const { error: updateErr } = await db
      .from('performance_stats')
      .update({ notified: true })
      .in('id', ids)

    if (updateErr) {
      log.error('publish-notify mark-notified failed', { team_id, error: updateErr.message })
      // Notification was already sent — don't fail the request, just log
    }

    log.info('performance stats published', {
      team_id,
      player_count: playerCount,
      published_by: requester.profile.id,
    })

    return NextResponse.json({
      ok: true,
      notified: playerCount,
      message: `Notified team about ${playerCount} player${playerCount !== 1 ? 's\'' : '\'s'} stats`,
    })

  } catch (e) {
    log.error('publish-notify unhandled exception', { message: e.message })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
