// app/api/pay/accountants/[id]/route.js
// Admin-only: update (deactivate/reactivate) or delete accountant
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'

const db = createServiceClient()

// PATCH - toggle is_active for an accountant
export async function PATCH(req, { params }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { is_active } = body

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

    // Fetch the target profile to verify team
    const { data: target, error: tErr } = await db.from('profiles')
      .select('id, team_id, role')
      .eq('id', id)
      .single()
    if (tErr || !target) return NextResponse.json({ error: 'Accountant not found' }, { status: 404 })
    if (target.role !== 'accountant') return NextResponse.json({ error: 'Target is not an accountant' }, { status: 400 })
    if (!canManageTeam(requester.profile, target.team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error: updateErr } = await db.from('profiles')
      .update({ is_active: !!is_active })
      .eq('id', id)

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE - permanently remove an accountant account
export async function DELETE(req, { params }) {
  try {
    const { id } = await params

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

    const { data: target, error: tErr } = await db.from('profiles')
      .select('id, team_id, role')
      .eq('id', id)
      .single()
    if (tErr || !target) return NextResponse.json({ error: 'Accountant not found' }, { status: 404 })
    if (target.role !== 'accountant') return NextResponse.json({ error: 'Target is not an accountant' }, { status: 400 })
    if (!canManageTeam(requester.profile, target.team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Delete profile first, then auth user
    await db.from('profiles').delete().eq('id', id)
    await db.auth.admin.deleteUser(id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
