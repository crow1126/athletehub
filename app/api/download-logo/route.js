import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const variant = searchParams.get('variant') || 'vertical-color'
    const format = searchParams.get('format') || 'png'

    const fileMap = {
      'vertical-color': {
        png: 'apextrack-gh-jersey-vertical-color.png',
        svg: 'apextrack-gh-vertical-color.svg',
      },
      'vertical-white': {
        png: 'apextrack-gh-jersey-vertical-white.png',
        svg: 'apextrack-gh-vertical-white.svg',
      },
      'horizontal-white': {
        png: 'apextrack-gh-jersey-horizontal-white.png',
        svg: 'apextrack-gh-horizontal-white.svg',
      },
      'horizontal-dark': {
        png: 'apextrack-gh-jersey-horizontal-dark.png',
        svg: 'apextrack-gh-horizontal-dark.svg',
      },
      'wordmark-white': {
        png: 'apextrack-gh-jersey-wordmark-white.png',
        svg: 'apextrack-gh-wordmark-white.svg',
      },
      'wordmark-dark': {
        png: 'apextrack-gh-jersey-wordmark-dark.png',
        svg: 'apextrack-gh-wordmark-dark.svg',
      },
      'default': {
        png: 'apextrack-gh-jersey-vertical-color.png',
        svg: 'apextrack-gh-vertical-color.svg',
      }
    }

    const mapping = fileMap[variant] || fileMap['default']
    const filename = format === 'svg' ? mapping.svg : mapping.png
    const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png'

    const filePath = path.join(process.cwd(), 'public', filename)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Logo file not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process logo download' }, { status: 500 })
  }
}
