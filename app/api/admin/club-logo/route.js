import { NextResponse } from 'next/server'
import { createServiceClient, getRequester, isSuperadmin } from '@/lib/serverAuth'
import { verifyImageMagicBytes, sanitizeSvgContent, sanitizeFilename } from '@/lib/imageSanitizer'

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

    const formData = await req.formData()
    const file = formData.get('file')
    const teamIdParam = formData.get('team_id')
    const clubNameParam = formData.get('club_name')
    const logoUrlParam = formData.get('logo_url')

    if (!file && !logoUrlParam) {
      return NextResponse.json({ error: 'Either an image file or logo_url is required' }, { status: 400 })
    }

    let teamId = teamIdParam

    // If teamId not provided, resolve or create team from clubName
    if (!teamId && clubNameParam) {
      const trimmedClub = clubNameParam.trim()
      const { data: existingTeam } = await db
        .from('teams')
        .select('id')
        .ilike('name', trimmedClub)
        .maybeSingle()

      if (existingTeam?.id) {
        teamId = existingTeam.id
      } else {
        const shortName = trimmedClub
          .split(' ')
          .map(w => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 4)

        const { data: newTeam, error: teamError } = await db
          .from('teams')
          .insert([{
            name: trimmedClub,
            short_name: shortName,
          }])
          .select()
          .single()

        if (teamError) throw teamError
        teamId = newTeam.id
      }
    }

    let publicUrl = logoUrlParam

    // If a file was uploaded, validate and upload to Supabase storage bucket `athlete-photos`
    if (file && typeof file === 'object' && file.name) {
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Image file too large. Max size is 5MB.' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      let buffer = Buffer.from(bytes)
      const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
      let uploadContentType = file.type || 'image/png'

      if (isSvg) {
        // Sanitize SVG text to strip scripts, event handlers, and XXE
        const rawSvg = buffer.toString('utf8')
        const cleanSvg = sanitizeSvgContent(rawSvg)
        buffer = Buffer.from(cleanSvg, 'utf8')
        uploadContentType = 'image/svg+xml'
      } else {
        // Verify Magic Bytes for raster images (JPEG, PNG, WEBP, GIF)
        const magic = verifyImageMagicBytes(buffer)
        if (!magic.valid) {
          return NextResponse.json(
            { error: 'Invalid or corrupted image file. Only verified JPG, PNG, WEBP, or SVG files are allowed.' },
            { status: 400 }
          )
        }
        uploadContentType = magic.mimeType
      }

      const safeBaseName = sanitizeFilename(file.name, isSvg ? 'svg' : 'png')
      const fileName = `club-logos/${teamId || 'club'}-${safeBaseName}`

      const { data: uploadData, error: uploadError } = await db.storage
        .from('athlete-photos')
        .upload(fileName, buffer, {
          contentType: uploadContentType,
          upsert: true,
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload logo: ' + uploadError.message }, { status: 500 })
      }

      const { data: publicUrlData } = db.storage
        .from('athlete-photos')
        .getPublicUrl(fileName)

      publicUrl = publicUrlData.publicUrl
    }

    if (!publicUrl) {
      return NextResponse.json({ error: 'Failed to determine public URL for logo' }, { status: 500 })
    }

    // Update teams table if teamId exists
    if (teamId) {
      await db
        .from('teams')
        .update({ logo_url: publicUrl })
        .eq('id', teamId)
    }

    // Update profiles matching teamId or clubName
    if (teamId) {
      await db
        .from('profiles')
        .update({ club_logo_url: publicUrl })
        .eq('team_id', teamId)
    }

    if (clubNameParam) {
      await db
        .from('profiles')
        .update({ club_logo_url: publicUrl })
        .ilike('club_name', clubNameParam.trim())
    }

    return NextResponse.json({
      success: true,
      logo_url: publicUrl,
      team_id: teamId,
      message: 'Club logo updated successfully everywhere.'
    })
  } catch (err) {
    console.error('Club logo upload error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
