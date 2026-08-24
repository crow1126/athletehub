// app/api/notices/route.js
// Team Notice Board API with instant Moolre SMS Broadcast & in-app Bell Notifications
import { NextResponse }                      from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'
import { sendBulkSMS, buildNoticeSMS }       from '@/lib/moolre'
import { payLimiter }                        from '@/lib/rateLimit'

const supabase = createServiceClient()

export async function GET(req) {
  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get('team_id') || requester.profile.team_id

    if (!teamId) {
      return NextResponse.json({ notices: [] })
    }

    // Verify team permission
    if (requester.profile.role !== 'superadmin' && requester.profile.team_id !== teamId) {
      return NextResponse.json({ error: 'Unauthorized for this team' }, { status: 403 })
    }

    const { data: notices, error } = await supabase
      .from('notices')
      .select('*')
      .eq('team_id', teamId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      // If table does not exist or general error, return empty list gracefully
      console.warn('[notices GET] query error:', error.message)
      return NextResponse.json({ notices: [] })
    }

    return NextResponse.json({ notices: notices || [] })
  } catch (err) {
    console.error('[notices GET] unexpected error:', err)
    return NextResponse.json({ error: err.message, notices: [] }, { status: 500 })
  }
}

export async function POST(req) {
  // Rate limit
  const limited = payLimiter(req)
  if (!limited.ok) return limited.response

  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    // Only coaches and admins (and superadmins) can post notices
    const userRole = requester.profile?.role || ''
    if (!['admin', 'coach', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Only Coaches and Admins can publish notices.' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title,
      content,
      category = 'general',
      target_group = 'all',
      is_pinned = false,
      send_sms = true,
      team_id: customTeamId
    } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 })
    }

    const teamId = customTeamId || requester.profile.team_id
    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required.' }, { status: 400 })
    }

    // Get club name for SMS prefix
    let clubName = requester.profile.club_name || ''
    if (!clubName && teamId) {
      const { data: t } = await supabase.from('teams').select('name').eq('id', teamId).single()
      if (t) clubName = t.name
    }

    const authorName = requester.profile.full_name || requester.user.email
    const authorRole = requester.profile.role || 'Staff'

    // 1. Insert Notice Record
    let noticeData = null
    const { data: inserted, error: insertError } = await supabase
      .from('notices')
      .insert([{
        team_id: teamId,
        title: title.trim(),
        content: content.trim(),
        category,
        target_group,
        is_pinned: !!is_pinned,
        author_id: requester.profile.id,
        author_name: authorName,
        author_role: authorRole,
        sms_sent: false,
        sms_count: 0,
        sms_failed: 0,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('[notices POST] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    noticeData = inserted

    let sent = 0
    let failed = 0
    let smsError = null
    let targetCount = 0

    // 2. Dispatch SMS via Moolre if requested
    if (send_sms) {
      let query = supabase
        .from('athletes')
        .select('id, name, phone, position')
        .eq('team_id', teamId)
        .not('phone', 'is', null)
        .neq('phone', '')

      // Target filter
      if (target_group === 'goalkeepers') {
        query = query.ilike('position', '%goalkeeper%')
      } else if (target_group === 'defenders') {
        query = query.or('position.ilike.%defender%,position.ilike.%back%,position.ilike.%cb%,position.ilike.%lb%,position.ilike.%rb%')
      } else if (target_group === 'midfielders') {
        query = query.or('position.ilike.%midfield%,position.ilike.%cm%,position.ilike.%dm%,position.ilike.%am%')
      } else if (target_group === 'forwards') {
        query = query.or('position.ilike.%forward%,position.ilike.%striker%,position.ilike.%winger%,position.ilike.%attacker%')
      }

      const { data: athletes, error: athErr } = await query

      if (athErr) {
        console.warn('[notices POST] fetch athletes error:', athErr.message)
      } else if (athletes && athletes.length > 0) {
        targetCount = athletes.length

        const recipients = athletes.map(ath => ({
          phone: ath.phone,
          message: buildNoticeSMS({
            athleteName: ath.name ? ath.name.split(' ')[0] : '',
            clubName: clubName,
            title: title.trim(),
            message: content.trim(),
            category,
            authorName,
          })
        }))

        const smsRes = await sendBulkSMS(recipients)
        sent = smsRes.sent || 0
        failed = smsRes.failed || 0
        smsError = smsRes.error || null

        // Update notice record with SMS stats
        await supabase
          .from('notices')
          .update({
            sms_sent: sent > 0,
            sms_count: sent,
            sms_failed: failed,
          })
          .eq('id', noticeData.id)

        // Log in notification_logs
        await supabase.from('notification_logs').insert({
          team_id: teamId,
          type: 'general',
          sent_count: sent,
          fail_count: failed,
          created_by: requester.profile.id,
        }).maybeSingle()
      }
    }

    // 3. Create In-App Bell Notification for team members
    try {
      const catLabel = category === 'urgent' ? '[URGENT]' : (category === 'matchday' ? '[MATCHDAY]' : (category === 'training' ? '[TRAINING]' : '[NOTICE]'))
      await supabase.from('notifications').insert({
        team_id: teamId,
        type: 'general',
        title: `${catLabel} ${title.trim()}`,
        body: `${content.trim()}${sent > 0 ? ` (${sent} players notified via SMS)` : ''}`,
        sent_count: sent,
      })
    } catch (nErr) {
      console.warn('[notices POST] bell notification insert error:', nErr.message)
    }

    return NextResponse.json({
      ok: true,
      notice: {
        ...noticeData,
        sms_sent: sent > 0,
        sms_count: sent,
        sms_failed: failed,
      },
      sent,
      failed,
      total: targetCount,
      smsError
    })
  } catch (err) {
    console.error('[notices POST] unexpected error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req) {
  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const userRole = requester.profile?.role || ''
    if (!['admin', 'coach', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Permission denied.' }, { status: 403 })
    }

    const { id, is_pinned, title, content, category, target_group } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Notice ID is required.' }, { status: 400 })
    }

    const updatePayload = { updated_at: new Date().toISOString() }
    if (is_pinned !== undefined) updatePayload.is_pinned = !!is_pinned
    if (title !== undefined) updatePayload.title = title.trim()
    if (content !== undefined) updatePayload.content = content.trim()
    if (category !== undefined) updatePayload.category = category
    if (target_group !== undefined) updatePayload.target_group = target_group

    let query = supabase.from('notices').update(updatePayload).eq('id', id)
    if (requester.profile.role !== 'superadmin') {
      query = query.eq('team_id', requester.profile.team_id)
    }

    const { data: updated, error } = await query.select().single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, notice: updated })
  } catch (err) {
    console.error('[notices PATCH] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const requester = await getRequester(req, supabase)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const userRole = requester.profile?.role || ''
    if (!['admin', 'coach', 'superadmin'].includes(userRole)) {
      return NextResponse.json({ error: 'Permission denied.' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Notice ID is required.' }, { status: 400 })
    }

    let query = supabase.from('notices').delete().eq('id', id)
    if (requester.profile.role !== 'superadmin') {
      query = query.eq('team_id', requester.profile.team_id)
    }

    const { error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Notice deleted successfully' })
  } catch (err) {
    console.error('[notices DELETE] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
