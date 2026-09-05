import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req) {
  try {
    let body = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }
    const { url, referrer } = body
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Get client headers
    const userAgent = req.headers.get('user-agent') || ''
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    const country = req.headers.get('x-vercel-ip-country') || ''

    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { error } = await db
      .from('site_clicks')
      .insert([
        {
          url,
          referrer,
          user_agent: userAgent,
          ip_address: ip,
          country,
        }
      ])

    if (error) {
      console.error('Failed to log click to site_clicks:', error.message)
      // We don't fail the client request for tracking issues (fail silently to client)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Click tracking route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
