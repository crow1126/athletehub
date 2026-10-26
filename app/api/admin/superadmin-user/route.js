import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, isSuperadmin } from '@/lib/serverAuth'

export async function GET(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)

    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    // Fetch all superadmin profiles
    const { data: superadmins, error: fetchErr } = await db
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active, registration_status, created_at')
      .eq('role', 'superadmin')
      .order('created_at', { ascending: true })

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    return NextResponse.json({
      superadmins: superadmins || [],
      currentUserId: requester.user.id,
    })
  } catch (err) {
    console.error('[superadmin-user GET] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)

    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const { full_name, email, password, phone } = await req.json()

    if (!full_name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Full name, email address, and password are required.' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check if profile with email already exists
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id, email, role')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: `An account with email "${normalizedEmail}" already exists.` }, { status: 409 })
    }

    // Create auth user with service client
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        role: 'superadmin',
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message || 'Failed to create auth user.' }, { status: 400 })
    }

    const newUserId = authData.user.id

    // Upsert into profiles as superadmin
    const { data: newProfile, error: profileError } = await db
      .from('profiles')
      .upsert({
        id: newUserId,
        email: normalizedEmail,
        full_name: full_name.trim(),
        phone: phone?.trim() || null,
        role: 'superadmin',
        is_active: true,
        registration_status: 'approved',
        team_id: null,
        club_name: 'Apextrack GH Platform',
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profileError) {
      console.error('[superadmin-user POST] profile creation error:', profileError)
      return NextResponse.json({ error: 'Auth user created, but profile setup failed: ' + profileError.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `Superadmin account "${normalizedEmail}" created successfully.`,
      user: newProfile,
    })
  } catch (err) {
    console.error('[superadmin-user POST] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)

    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const { targetUserId, is_active, full_name, phone, new_password } = await req.json()

    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
    }

    // Safety guard: cannot deactivate yourself
    if (targetUserId === requester.user.id && is_active === false) {
      return NextResponse.json({ error: 'Action denied: You cannot deactivate your own superadmin account.' }, { status: 400 })
    }

    const updates = {}
    if (typeof is_active === 'boolean') updates.is_active = is_active
    if (typeof full_name === 'string' && full_name.trim()) updates.full_name = full_name.trim()
    if (typeof phone === 'string') updates.phone = phone.trim() || null

    const { data: updatedProfile, error: updateErr } = await db
      .from('profiles')
      .update(updates)
      .eq('id', targetUserId)
      .eq('role', 'superadmin')
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // If new password provided, update auth user
    if (new_password) {
      if (new_password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
      }
      const { error: pwErr } = await db.auth.admin.updateUserById(targetUserId, { password: new_password })
      if (pwErr) {
        return NextResponse.json({ error: 'Profile updated, but password reset failed: ' + pwErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: 'Superadmin account updated successfully.',
      user: updatedProfile,
    })
  } catch (err) {
    console.error('[superadmin-user PATCH] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)

    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden: Superadmin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get('userId')

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    // Safety guard: cannot delete yourself
    if (targetUserId === requester.user.id) {
      return NextResponse.json({ error: 'Action denied: You cannot delete your own superadmin account.' }, { status: 400 })
    }

    // Verify there is at least one other superadmin
    const { count, error: countErr } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'superadmin')

    if (!countErr && count <= 1) {
      return NextResponse.json({ error: 'Action denied: Cannot delete the only remaining superadmin.' }, { status: 400 })
    }

    // Delete profile
    await db.from('profiles').delete().eq('id', targetUserId)

    // Delete auth user
    const { error: authDelErr } = await db.auth.admin.deleteUser(targetUserId)
    if (authDelErr) {
      console.warn('[superadmin-user DELETE] warning deleting auth user:', authDelErr.message)
    }

    return NextResponse.json({ message: 'Superadmin user deleted successfully.' })
  } catch (err) {
    console.error('[superadmin-user DELETE] error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
