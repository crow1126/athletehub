import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, isSuperadmin } from '@/lib/serverAuth'

/**
 * POST /api/admin/confirm-email
 * Marks a user's auth email as confirmed (superadmin only).
 * Body: { user_id }
 */
export async function POST(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }
    if (!isSuperadmin(requester.profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const { error } = await db.auth.admin.updateUserById(user_id, { email_confirm: true })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
