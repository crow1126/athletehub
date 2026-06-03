// app/api/webhooks/moolre-ussd/route.js
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/serverAuth'
import { normalizeGhPhone } from '@/lib/moolre'

export async function POST(req) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let reqBody = {}

    // 1. Parse body (support JSON and URL-encoded form data)
    if (contentType.includes('application/json')) {
      reqBody = await req.json()
    } else {
      const text = await req.text()
      const params = new URLSearchParams(text)
      for (const [key, val] of params.entries()) {
        reqBody[key] = val
      }
    }

    console.log('[USSD Webhook] Received request:', reqBody)

    // 2. Extract USSD fields (support standard variations across gateways)
    const phoneInput = reqBody.msisdn || reqBody.phoneNumber || reqBody.phonenumber || reqBody.phone || reqBody.Mobile || reqBody.mobile || reqBody.sender
    const sessionId = reqBody.sessionid || reqBody.sessionId || reqBody.SessionId || reqBody.session_id
    let userInput = reqBody.userdata || reqBody.userData || reqBody.message || reqBody.Message || reqBody.msg || reqBody.text || reqBody.input || ''
    
    // Check if it's an explicit session end/release from the gateway
    const isRelease = reqBody.Type === 'Release' || reqBody.type === 'Release' || reqBody.type === 'end'

    if (!sessionId || !phoneInput) {
      return NextResponse.json({ error: 'Missing sessionid or phone' }, { status: 400 })
    }

    const db = createServiceClient()

    // 3. Clean up expired sessions (older than 5 minutes) to keep DB healthy
    await db
      .from('ussd_sessions')
      .delete()
      .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

    if (isRelease) {
      await db.from('ussd_sessions').delete().eq('session_id', sessionId)
      return returnResponse(req, { message: 'Goodbye', isEnd: true, sessionId })
    }

    // 4. Normalize phone number and look up athlete
    const normalizedPhone = normalizeGhPhone(phoneInput)
    if (!normalizedPhone) {
      return returnResponse(req, {
        message: 'Invalid phone number format. Please ensure your SIM is registered.',
        isEnd: true,
        sessionId
      })
    }

    // Look up athlete by phone (ending with subscriber number)
    const last9 = normalizedPhone.slice(-9)
    const { data: athletes, error: athError } = await db
      .from('athletes')
      .select('id, name, phone, team_id')
      .like('phone', `%${last9}`)

    if (athError) {
      console.error('[USSD Webhook] Athlete query error:', athError)
      return returnResponse(req, { message: 'Database error. Please try again later.', isEnd: true, sessionId })
    }

    const athlete = athletes?.find(a => normalizeGhPhone(a.phone) === normalizedPhone)

    if (!athlete) {
      return returnResponse(req, {
        message: `Sorry, your number (${phoneInput}) is not registered on ApexTrack. Contact your admin.`,
        isEnd: true,
        sessionId
      })
    }

    // Get athlete's first name
    const firstName = athlete.name.split(' ')[0]

    // 5. Manage session state
    // Clean user input if the gateway includes the base shortcode (e.g. *920*100#)
    if (userInput.startsWith('*') && userInput.endsWith('#')) {
      userInput = ''
    }

    // Load or create session
    const { data: session } = await db
      .from('ussd_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle()

    let path = []
    let isNewSession = !session || !userInput

    if (isNewSession) {
      // Create new session or upsert
      await db.from('ussd_sessions').upsert({
        session_id: sessionId,
        phone: normalizedPhone,
        current_menu: 'main',
        accumulated_input: '',
        updated_at: new Date().toISOString()
      })
      path = []
    } else {
      // Determine the path based on user input
      let prevAccumulated = session.accumulated_input || ''
      
      if (userInput.includes('*') || userInput.startsWith(prevAccumulated + '*')) {
        // Gateway sends full path history (e.g. "1*2")
        path = userInput.split('*').map(x => x.trim()).filter(Boolean)
      } else {
        // Gateway sends only the last keypress (e.g. "2" when prev was "1")
        const prevPath = prevAccumulated ? prevAccumulated.split('*') : []
        if (userInput === '0' || userInput === 'back') {
          prevPath.pop()
          path = prevPath
        } else {
          path = [...prevPath, userInput]
        }
      }
    }

    // 6. State Machine Menu logic
    let menuText = ''
    let isEnd = false
    let currentMenu = 'main'
    let invalidOption = false

    if (path.length === 0) {
      // --- MAIN MENU ---
      menuText = `ApexTrack - Welcome, ${firstName}!\n`
      menuText += '1. Next Training Session\n'
      menuText += '2. Recent Sessions\n'
      menuText += '3. My Team'
      currentMenu = 'main'
    } else {
      const choice = path[0]

      if (choice === '1') {
        // --- NEXT TRAINING SESSION ---
        const today = new Date().toISOString().split('T')[0]
        const { data: upcoming, error: sErr } = await db
          .from('training_sessions')
          .select('*')
          .eq('team_id', athlete.team_id) // Strict Multi-Tenancy Scoping
          .gte('date', today)
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (sErr) {
          menuText = 'Error fetching schedule. Please try again.\n0. Back'
        } else if (!upcoming) {
          menuText = 'No upcoming training sessions scheduled.\n\n0. Back'
        } else {
          const dateStr = new Date(upcoming.date).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          })
          menuText = `Next Session:\n`
          menuText += `Type: ${upcoming.type || 'Training'}\n`
          menuText += `Title: ${upcoming.title}\n`
          menuText += `Date: ${dateStr} @ ${upcoming.time}\n`
          menuText += `Venue: ${upcoming.venue || 'TBD'}\n\n`
          menuText += '0. Back'
        }
        currentMenu = 'next_session'
      } 
      else if (choice === '2') {
        // --- RECENT TRAINING SESSIONS ---
        const today = new Date().toISOString().split('T')[0]
        const { data: recent, error: rErr } = await db
          .from('training_sessions')
          .select('*')
          .eq('team_id', athlete.team_id) // Strict Multi-Tenancy Scoping
          .lte('date', today)
          .order('date', { ascending: false })
          .order('time', { ascending: false })
          .limit(3)

        if (rErr) {
          menuText = 'Error fetching recent sessions.\n0. Back'
        } else if (!recent || recent.length === 0) {
          menuText = 'No recent training sessions found.\n\n0. Back'
        } else if (path.length === 1) {
          // --- LEVEL 1: LIST RECENT ---
          menuText = 'Recent Sessions:\n'
          recent.forEach((session, idx) => {
            const dateStr = new Date(session.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short'
            })
            menuText += `${idx + 1}. ${session.title} (${dateStr})\n`
          })
          menuText += '\nSelect # to view details\n0. Back'
          currentMenu = 'recent_list'
        } else {
          // --- LEVEL 2: RECENT DETAILS ---
          const idx = parseInt(path[1]) - 1
          if (idx >= 0 && idx < recent.length) {
            const selected = recent[idx]
            const dateStr = new Date(selected.date).toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short'
            })
            menuText = `${selected.title} (${selected.type || 'Training'})\n`
            menuText += `Date: ${dateStr} @ ${selected.time}\n`
            menuText += `Venue: ${selected.venue || 'TBD'}\n`
            if (selected.duration) menuText += `Duration: ${selected.duration} mins\n`
            if (selected.notes) menuText += `Notes: ${selected.notes.slice(0, 40)}\n`
            menuText += '\n0. Back'
            currentMenu = 'recent_detail'
          } else {
            // Invalid recent session choice
            path.pop() // remove invalid index
            menuText = 'Invalid option.\nRecent Sessions:\n'
            recent.forEach((session, idx) => {
              const dateStr = new Date(session.date).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short'
              })
              menuText += `${idx + 1}. ${session.title} (${dateStr})\n`
            })
            menuText += '\nSelect # to view details\n0. Back'
            currentMenu = 'recent_list'
            invalidOption = true
          }
        }
      } 
      else if (choice === '3') {
        // --- MY TEAM (displays the club/team name) ---
        const { data: team, error: tErr } = await db
          .from('teams')
          .select('name')
          .eq('id', athlete.team_id) // Strict Multi-Tenancy Scoping
          .single()

        if (tErr || !team) {
          menuText = 'Error fetching team info.\n0. Back'
        } else {
          menuText = `My Club:\n`
          menuText += `Name: ${team.name}\n\n`
          menuText += '0. Back'
        }
        currentMenu = 'my_team'
      } 
      else {
        // Invalid main menu choice
        path = [] // reset path to main menu
        menuText = 'Invalid option.\nApexTrack - Welcome, ' + firstName + '!\n'
        menuText += '1. Next Training Session\n'
        menuText += '2. Recent Sessions\n'
        menuText += '3. My Team'
        currentMenu = 'main'
        invalidOption = true
      }
    }

    // 7. Update database session state
    if (!invalidOption) {
      await db.from('ussd_sessions').upsert({
        session_id: sessionId,
        phone: normalizedPhone,
        current_menu: currentMenu,
        accumulated_input: path.join('*'),
        updated_at: new Date().toISOString()
      })
    }

    return returnResponse(req, { message: menuText, isEnd, sessionId })

  } catch (err) {
    console.error('[USSD Webhook ERROR]:', err)
    return returnResponse(req, { message: 'An unexpected system error occurred.', isEnd: true, sessionId: reqBody.sessionid || 'unknown' })
  }
}

// Helper to format response based on gateway headers
function returnResponse(req, { message, isEnd, sessionId }) {
  const accept = req.headers.get('accept') || ''
  const isPlain = accept.includes('text/plain')

  const actionPrefix = isEnd ? 'END ' : 'CON '
  const formattedMessage = actionPrefix + message

  if (isPlain) {
    return new Response(formattedMessage, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  // JSON format for Moolre, FlexUSSD, Hubtel, etc.
  return NextResponse.json({
    // Standard properties supporting both JSON and plain-text-in-JSON schemas
    message: formattedMessage, // e.g. CON Welcome
    Message: message,          // e.g. Welcome (raw text)
    Type: isEnd ? 'Release' : 'Response', // Hubtel/FlexUSSD format
    type: isEnd ? 'end' : 'continue',
    action: isEnd ? 'end' : 'continue',
    continueSession: !isEnd,
    SessionId: sessionId,
    sessionId: sessionId,
    status: 1
  })
}
