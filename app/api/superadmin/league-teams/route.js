import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, isSuperadmin } from '@/lib/serverAuth'
import { verifyImageMagicBytes, sanitizeSvgContent, sanitizeFilename } from '@/lib/imageSanitizer'
import { DEFAULT_GPL_TEAMS } from '@/lib/gplTeams'

export async function GET(req) {
  try {
    const db = createServiceClient()
    const requester = await getRequester(req, db)
    if (requester.error) {
      return NextResponse.json({ error: requester.error }, { status: requester.status })
    }

    const { data, error } = await db
      .from('league_teams')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      // Gracefully return default seeded list with migrationPending flag if table isn't created yet
      if (error.message?.includes('league_teams') || error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json({ teams: DEFAULT_GPL_TEAMS, migrationPending: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ teams: (data && data.length > 0) ? data : DEFAULT_GPL_TEAMS, migrationPending: false })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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

    const contentType = req.headers.get('content-type') || ''
    let id = null
    let name = ''
    let short_name = ''
    let league = 'Ghana Premier League'
    let season = '2026/2027'
    let logo_url = ''
    let is_active = true
    let file = null

    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData()
      id = fd.get('id') || null
      name = String(fd.get('name') || '').trim()
      short_name = String(fd.get('short_name') || '').trim()
      league = String(fd.get('league') || 'Ghana Premier League').trim()
      season = String(fd.get('season') || '2026/2027').trim()
      logo_url = String(fd.get('logo_url') || '').trim()
      is_active = fd.get('is_active') !== 'false'
      file = fd.get('file')
    } else {
      const body = await req.json()
      id = body.id || null
      name = String(body.name || '').trim()
      short_name = String(body.short_name || '').trim()
      league = String(body.league || 'Ghana Premier League').trim()
      season = String(body.season || '2026/2027').trim()
      logo_url = String(body.logo_url || '').trim()
      is_active = body.is_active !== false
    }

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
    }

    if (file && typeof file === 'object' && file.name) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image file too large. Max size is 5MB.' }, { status: 400 })
      }
      const bytes = await file.arrayBuffer()
      let buffer = Buffer.from(bytes)
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
      let uploadContentType = file.type || 'image/png'

      if (isSvg) {
        buffer = Buffer.from(sanitizeSvgContent(buffer.toString('utf8')), 'utf8')
        uploadContentType = 'image/svg+xml'
      } else {
        const magic = verifyImageMagicBytes(buffer)
        if (!magic.valid) {
          return NextResponse.json(
            { error: 'Invalid image file. Only JPG, PNG, WEBP, GIF, or SVG files are allowed.' },
            { status: 400 }
          )
        }
        uploadContentType = magic.mimeType
      }

      const safeBaseName = sanitizeFilename(file.name, isSvg ? 'svg' : 'png')
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const fileName = `league-teams/${slug}-${Date.now()}-${safeBaseName}`

      const { error: uploadError } = await db.storage
        .from('athlete-photos')
        .upload(fileName, buffer, { contentType: uploadContentType, upsert: true })

      if (uploadError) {
        return NextResponse.json({ error: 'Failed to upload logo: ' + uploadError.message }, { status: 500 })
      }

      const { data: publicUrlData } = db.storage.from('athlete-photos').getPublicUrl(fileName)
      logo_url = publicUrlData.publicUrl
    }

    const derivedShort = short_name || name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4)

    const payload = {
      name,
      short_name: derivedShort,
      league: league || 'Ghana Premier League',
      season: season || '2026/2027',
      logo_url: logo_url || null,
      is_active,
      updated_at: new Date().toISOString(),
    }

    if (id) {
      const { data, error } = await db
        .from('league_teams')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ team: data })
    } else {
      const { data, error } = await db
        .from('league_teams')
        .insert([payload])
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ team: data })
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
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
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Team id is required' }, { status: 400 })
    }

    const { error } = await db.from('league_teams').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
