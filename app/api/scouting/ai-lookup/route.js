import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'
import { generalLimiter } from '@/lib/rateLimit'

const supabase = createServiceClient()

// Deterministic generator fallback if GROQ_API_KEY is not defined
function generatePlayerProfile(name) {
  const query = name.trim()
  if (query.length < 2) return null

  const hash = query.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  const positions = ['Forward', 'Midfielder', 'Defender', 'Goalkeeper']
  const nationalities = ['Ghana', 'Nigeria', 'Spain', 'England', 'France', 'Brazil', 'Argentina', 'Germany', 'Ivory Coast']
  const clubs = ['Free Agent', 'Hearts of Oak', 'Asante Kotoko', 'Real Tamale United', 'FC Barcelona', 'Real Madrid', 'Manchester United', 'Arsenal FC', 'Al Hilal']

  const pos = positions[hash % positions.length]
  const nat = nationalities[(hash * 3) % nationalities.length]
  const club = clubs[(hash * 7) % clubs.length]
  const age = 17 + (hash % 18)
  const preferred = (hash % 3 === 0) ? 'Left' : (hash % 6 === 0) ? 'Both' : 'Right'

  const technical = 4 + (hash % 6)
  const physical = 4 + ((hash * 2) % 6)
  const tactical = 4 + ((hash * 3) % 6)
  const overall = Math.round((technical + physical + tactical) / 3)

  const valMil = 1 + (hash % 70)
  const market_value = `€${valMil},000,000`

  return {
    player_name: query,
    age,
    nationality: nat,
    current_club: club,
    position: pos,
    height: 168 + (hash % 28),
    weight: 58 + (hash % 28),
    preferred_foot: preferred,
    market_value,
    contract_until: '2028-06-30',
    overall_rating: overall,
    technical_rating: technical,
    physical_rating: physical,
    tactical_rating: tactical,
    notes: `[Offline Fallback] Generated attributes for a ${age}-year-old ${pos.toLowerCase()} based on signature profile.`,
  }
}

export async function GET(req) {
  // Rate limit by IP (30 requests / minute)
  const limited = generalLimiter(req)
  if (!limited.ok) return limited.response

  try {
    // Auth check — only authenticated users can trigger AI lookups
    const requester = await getRequester(req, supabase)
    if (requester.error) return NextResponse.json({ error: requester.error }, { status: requester.status })

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters long.' }, { status: 400 })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      const fallbackData = generatePlayerProfile(query)
      return NextResponse.json({
        source: 'fallback',
        warning: 'GROQ_API_KEY not configured. Using deterministic offline generator.',
        data: fallbackData
      })
    }

    const systemPrompt = `You are an expert football scout database. When given a player name, return ONLY a valid JSON object with these exact fields:
- player_name (string): full name
- age (integer): current age in 2026
- nationality (string): country
- current_club (string): current club or "Free Agent"
- position (string): MUST be exactly one of: Forward, Midfielder, Defender, Goalkeeper
- height (integer): height in cm
- weight (integer): weight in kg
- preferred_foot (string): MUST be exactly one of: Right, Left, Both
- market_value (string): e.g. "€45,000,000"
- contract_until (string): date in YYYY-MM-DD format
- overall_rating (integer): 1-10
- technical_rating (integer): 1-10
- physical_rating (integer): 1-10
- tactical_rating (integer): 1-10
- notes (string): 2-3 sentences of scouting report

If the player is a known professional footballer, use their real stats. If unknown, generate plausible realistic stats. Return ONLY the JSON object, no markdown, no extra text.`

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Retrieve the scouting profile for football player: "${query.trim()}"` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500
      })
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('Groq API Error:', res.status, errBody)

      const fallbackData = generatePlayerProfile(query)
      return NextResponse.json({
        source: 'fallback',
        warning: `Groq API error (${res.status}). Using offline fallback.`,
        data: fallbackData
      })
    }

    const raw = await res.json()
    const text = raw.choices?.[0]?.message?.content

    if (!text) {
      throw new Error('Empty response from Groq API.')
    }

    let playerData
    try {
      playerData = JSON.parse(text)
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match) {
        playerData = JSON.parse(match[1])
      } else {
        throw new Error('Could not parse JSON from Groq response.')
      }
    }

    return NextResponse.json({
      source: 'ai',
      data: playerData
    })

  } catch (error) {
    console.error('AI Lookup Route Error:', error)
    // Always fall back gracefully
    const query = new URL(req.url).searchParams.get('query') || ''
    const fallbackData = generatePlayerProfile(query)
    return NextResponse.json({
      source: 'fallback',
      warning: 'Unexpected error. Using offline fallback.',
      data: fallbackData
    })
  }
}
