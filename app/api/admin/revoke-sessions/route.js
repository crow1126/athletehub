import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { user_id } = await req.json()
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

    // Signs out ALL sessions for this user globally — immediate effect
    const { error } = await supabaseAdmin.auth.admin.signOut(user_id, 'global')
    if (error) {
      console.warn('Session revoke warning:', error.message)
      // Non-fatal — password was still changed
      return NextResponse.json({ success: true, warning: error.message })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Revoke sessions error:', err)
    return NextResponse.json({ success: true, warning: err.message })
  }
}