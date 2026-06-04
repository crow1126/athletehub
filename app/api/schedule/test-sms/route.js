// app/api/schedule/test-sms/route.js
// Admin-only test endpoint — sends a test SMS to a specific number
// Usage: POST { "phone": "0241234567" }
// Only accessible to authenticated users

import { NextResponse }             from 'next/server'
import { getRequester, createServiceClient } from '@/lib/serverAuth'
import { sendSMS }                  from '@/lib/moolre'

const supabase = createServiceClient()

export async function POST(req) {
  const requester = await getRequester(req, supabase)
  if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

  const { phone } = await req.json()
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const vasKey = process.env.MOOLRE_VAS_KEY
  const senderid = process.env.MOOLRE_SMS_SENDER_ID || 'ApexTrack'

  // Config check — tell user exactly what's missing
  const configErrors = []
  if (!process.env.MOOLRE_API_USER)     configErrors.push('MOOLRE_API_USER not set')
  if (!process.env.MOOLRE_PUBLIC_KEY)   configErrors.push('MOOLRE_PUBLIC_KEY not set')
  if (!vasKey || vasKey === 'your_moolre_vas_key_here') configErrors.push('MOOLRE_VAS_KEY not set or still placeholder')
  if (!process.env.MOOLRE_ACCOUNT_NUMBER) configErrors.push('MOOLRE_ACCOUNT_NUMBER not set')

  if (configErrors.length > 0) {
    return NextResponse.json({
      ok: false,
      config_errors: configErrors,
      hint: 'Set these in your env variables and redeploy/restart',
    }, { status: 400 })
  }

  const result = await sendSMS(phone, `ApexTrack test SMS ✅ — SMS notifications are working! Sender: ${senderid}`)

  return NextResponse.json({
    ok: result.sent > 0,
    sent: result.sent,
    failed: result.failed,
    error: result.error || null,
    phone_normalized: phone,
    moolre_response: result.data || null,
  })
}

export async function GET(req) {
  const keysToCheck = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MOOLRE_VAS_KEY',
    'MOOLRE_API_USER',
    'MOOLRE_PUBLIC_KEY',
    'MOOLRE_SECRET_KEY',
    'MOOLRE_ACCOUNT_NUMBER',
    'MOOLRE_SMS_SENDER_ID',
    'MOOLRE_BASE_URL'
  ]

  const diagnostics = {}

  for (const key of keysToCheck) {
    const val = process.env[key]
    if (val === undefined || val === null) {
      diagnostics[key] = { exists: false }
    } else {
      const trimmed = val.trim()
      diagnostics[key] = {
        exists: true,
        length: val.length,
        hasQuotes: (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")),
        hasLeadingOrTrailingWhitespace: val !== trimmed,
        hasNewlines: val.includes('\n') || val.includes('\r'),
        masked: val.length > 8 
          ? `${val.slice(0, 4)}...${val.slice(-4)}`
          : '***'
      }
    }
  }

  return NextResponse.json({
    message: "Environment variables diagnostics (Safely masked)",
    timestamp: new Date().toISOString(),
    diagnostics
  })
}

