import { NextResponse } from 'next/server'
import { createServiceClient, getRequester } from '@/lib/serverAuth'
import { generalLimiter } from '@/lib/rateLimit'

const supabase = createServiceClient()

// Deterministic generator fallback if AI services fail or keys are unconfigured
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

function parseModelJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match) return JSON.parse(match[1])
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1))
    }
    throw new Error('Invalid JSON format in model output.')
  }
}

async function callClaudeHaiku(query, systemPrompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Retrieve the scouting profile for football player: "${query.trim()}"` }
      ]
    })
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errorMsg = body?.error?.message || `Anthropic HTTP Error ${res.status}`
    throw new Error(`Claude Haiku API error: ${errorMsg}`)
  }

  const text = body.content?.[0]?.text
  if (!text) throw new Error('Empty text content returned from Claude Haiku.')

  return parseModelJson(text)
}

async function callGroq(query, systemPrompt, apiKey) {
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

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const errorMsg = body?.error?.message || `Groq HTTP Error ${res.status}`
    throw new Error(`Groq API error: ${errorMsg}`)
  }

  const text = body.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from Groq API.')

  return parseModelJson(text)
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

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const groqKey = process.env.GROQ_API_KEY

    let lastError = null

    // 1. Try Claude Haiku first if Anthropic API Key is configured
    if (anthropicKey) {
      try {
        const data = await callClaudeHaiku(query, systemPrompt, anthropicKey)
        return NextResponse.json({
          source: 'claude-haiku',
          model: 'claude-3-5-haiku-20241022',
          data
        })
      } catch (err) {
        console.error('Claude Haiku API lookup failed:', err.message)
        lastError = err.message
      }
    }

    // 2. Fallback to Groq if configured
    if (groqKey) {
      try {
        const data = await callGroq(query, systemPrompt, groqKey)
        return NextResponse.json({
          source: 'groq-fallback',
          warning: lastError ? `Anthropic Claude notice: ${lastError}. Used Groq fallback.` : null,
          data
        })
      } catch (err) {
        console.error('Groq API lookup failed:', err.message)
        if (!lastError) lastError = err.message
      }
    }

    // 3. Fallback to deterministic generator
    const fallbackData = generatePlayerProfile(query)
    return NextResponse.json({
      source: 'offline-fallback',
      warning: lastError ? `AI lookup notice: ${lastError}. Using offline fallback.` : 'No AI provider keys configured. Using offline fallback.',
      data: fallbackData
    })

  } catch (error) {
    console.error('AI Lookup Route Error:', error)
    const query = new URL(req.url).searchParams.get('query') || ''
    const fallbackData = generatePlayerProfile(query)
    return NextResponse.json({
      source: 'offline-fallback',
      warning: 'Unexpected error during scouting lookup. Using offline fallback.',
      data: fallbackData
    })
  }
}
