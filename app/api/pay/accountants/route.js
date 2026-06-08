// app/api/pay/accountants/route.js
// Admin-only: list and create accountant profiles for a team
import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, canManageTeam } from '@/lib/serverAuth'

const db = createServiceClient()

// GET - list all accountants for a team
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const team_id = searchParams.get('team_id')
    if (!team_id) return NextResponse.json({ error: 'team_id required' }, { status: 400 })

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: accountants, error } = await db
      .from('profiles')
      .select('id, full_name, email, is_active, created_at')
      .eq('team_id', team_id)
      .eq('role', 'accountant')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ accountants: accountants || [] })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST - create a new accountant account for a team
export async function POST(req) {
  try {
    const body = await req.json()
    const { team_id, full_name, email, password } = body

    if (!team_id || !full_name || !email || !password) {
      return NextResponse.json({ error: 'team_id, full_name, email, and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const requester = await getRequester(req, db)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })
    if (!canManageTeam(requester.profile, team_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Check no existing accountant with this email
    const { data: existing } = await db.auth.admin.listUsers()
    const existingUser = (existing?.users || []).find(u => u.email === email.trim().toLowerCase())
    if (existingUser) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    // Create the auth user
    const { data: newUser, error: createErr } = await db.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Skip email confirmation
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })

    // Upsert a profile for this user with role=accountant
    const { error: profileErr } = await db.from('profiles').upsert({
      id:        newUser.user.id,
      full_name: full_name.trim(),
      email:     email.trim().toLowerCase(),
      role:      'accountant',
      team_id,
      is_active: true,
    }, { onConflict: 'id' })

    if (profileErr) {
      // Clean up the created auth user
      await db.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: newUser.user.id })
  } catch (e) {
    console.error('[pay/accountants POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
