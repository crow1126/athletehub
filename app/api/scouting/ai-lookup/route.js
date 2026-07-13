import { NextResponse } from 'next/server'

// Deterministic generator fallback if GEMINI_API_KEY is not defined
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
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters long.' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Return fallback data with indicator
      const fallbackData = generatePlayerProfile(query)
      return NextResponse.json({
        source: 'fallback',
        warning: 'GEMINI_API_KEY not configured. Using deterministic offline generator.',
        data: fallbackData
      })
    }

    // Call Gemini API with gemini-3.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`
    
    const prompt = `You are an expert football scout. Retrieve details for the professional football player named "${query}" as of 2026.
If the player is well-known, return their real details. If the player does not exist or is fictional, generate realistic professional football stats, height, weight, preferred foot, and market value for them based on the name. Do not return empty fields.
You must return a JSON object containing the fields specified in the schema. Make sure the 'position' is exactly one of the allowed options: "Forward", "Midfielder", "Defender", "Goalkeeper". Make sure 'preferred_foot' is exactly one of "Right", "Left", "Both".`

    const responseSchema = {
      type: 'OBJECT',
      properties: {
        player_name: { type: 'STRING', description: 'Full professional name of the player' },
        age: { type: 'INTEGER', description: 'Current age as of year 2026' },
        nationality: { type: 'STRING', description: 'Nationality or country representing' },
        current_club: { type: 'STRING', description: 'Current club or Free Agent' },
        position: { type: 'STRING', description: 'Allowed values: Forward, Midfielder, Defender, Goalkeeper' },
        height: { type: 'INTEGER', description: 'Height in cm' },
        weight: { type: 'INTEGER', description: 'Weight in kg' },
        preferred_foot: { type: 'STRING', description: 'Allowed values: Right, Left, Both' },
        market_value: { type: 'STRING', description: 'Current market value, formatted e.g. €45,000,000' },
        contract_until: { type: 'STRING', description: 'YYYY-MM-DD or empty string' },
        overall_rating: { type: 'INTEGER', description: 'Overall ability rating out of 10 (1-10)' },
        technical_rating: { type: 'INTEGER', description: 'Technical rating out of 10 (1-10)' },
        physical_rating: { type: 'INTEGER', description: 'Physical rating out of 10 (1-10)' },
        tactical_rating: { type: 'INTEGER', description: 'Tactical rating out of 10 (1-10)' },
        notes: { type: 'STRING', description: '2-3 sentences of scouting report detailing player strengths and style.' }
      },
      required: [
        'player_name', 'age', 'nationality', 'current_club', 'position',
        'height', 'weight', 'preferred_foot', 'market_value', 'contract_until',
        'overall_rating', 'technical_rating', 'physical_rating', 'tactical_rating', 'notes'
      ]
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema
        }
      })
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      console.error('Gemini API Error:', res.status, errBody)
      
      // Detect billing/quota issues specifically
      const isBillingError = res.status === 429 || res.status === 403
      const warning = isBillingError
        ? 'Gemini API quota exhausted or billing not enabled. Using offline fallback. Enable billing at https://aistudio.google.com/ to unlock live search.'
        : `Gemini API error (${res.status}). Using deterministic offline generator.`
      
      const fallbackData = generatePlayerProfile(query)
      return NextResponse.json({
        source: 'fallback',
        warning,
        data: fallbackData
      })
    }

    const rawData = await res.json()
    const textResult = rawData.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!textResult) {
      throw new Error('Invalid response from Gemini API: candidate/part missing.')
    }

    // Gemini may return pure JSON or markdown-wrapped JSON — handle both
    let playerData
    try {
      playerData = JSON.parse(textResult)
    } catch {
      const match = textResult.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match) {
        playerData = JSON.parse(match[1])
      } else {
        throw new Error('Could not parse JSON from Gemini response.')
      }
    }

    return NextResponse.json({
      source: 'ai',
      data: playerData
    })

  } catch (error) {
    console.error('AI Lookup Route Error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve AI player data.',
      details: error.message
    }, { status: 500 })
  }
}
