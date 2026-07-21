import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'logo.png')
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Logo file not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)
    
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="apextrack-logo.png"',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process logo download' }, { status: 500 })
  }
}
