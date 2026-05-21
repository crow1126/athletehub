import { NextResponse } from 'next/server'
import { canManageTeam, createServiceClient, getRequester } from '@/lib/serverAuth'

export async function POST(req) {
  try {
    const supabaseAdmin = createServiceClient()
    const requester = await getRequester(req, supabaseAdmin)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const { user_id } = await req.json()
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    if (requester.profile.id !== user_id) {
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('team_id')
        .eq('id', user_id)
        .single()

      if (!targetProfile?.team_id || !canManageTeam(requester.profile, targetProfile.team_id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { error } = await supabaseAdmin.auth.admin.signOut(user_id, 'global')
    if (error) {
      console.warn('Session revoke warning:', error.message)
      return NextResponse.json({ success: true, warning: error.message })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Revoke sessions error:', err)
    return NextResponse.json({ success: true, warning: err.message })
  }
}
