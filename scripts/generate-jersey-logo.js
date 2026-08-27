const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const publicDir = path.join(__dirname, '..', 'public')

// ── 1. Vertical Emblem + Text (Navy & Teal for Light Kits) ───────────────────
const svgVerticalFull = `
<svg width="2400" height="2400" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tealGrad" x1="280" y1="360" x2="880" y2="700" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00A896"/>
      <stop offset="50%" stop-color="#0D9488"/>
      <stop offset="100%" stop-color="#028090"/>
    </linearGradient>
    <linearGradient id="navyGrad" x1="300" y1="180" x2="750" y2="680" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0B192C"/>
      <stop offset="100%" stop-color="#1E3E62"/>
    </linearGradient>
  </defs>

  <!-- APEX ICON EMBLEM (Centered) -->
  <g transform="translate(60, 40)">
    <!-- Left Leg of A -->
    <path d="M510 150 H570 L390 670 H270 L510 150 Z" fill="url(#navyGrad)"/>
    
    <!-- Right Leg of A -->
    <path d="M570 150 L810 670 H690 L625 530 H510 L570 400 L570 150 Z" fill="url(#navyGrad)"/>

    <!-- Dynamic Flying Swoosh across A -->
    <path d="M270 670 C360 570 480 430 815 250 C720 380 610 510 420 620 C370 650 320 665 270 670 Z" fill="url(#tealGrad)"/>

    <!-- Lower Swoosh Shadow Contour -->
    <path d="M270 670 C320 665 370 650 420 620 C510 565 580 500 640 430 L700 570 C650 610 580 650 500 670 H270 Z" fill="#0F766E" fill-opacity="0.3"/>
  </g>

  <!-- "APEXTRACK GH" WORDMARK -->
  <text x="600" y="890" text-anchor="middle" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="82" letter-spacing="4">
    <tspan fill="#0B192C">APEXTRACK</tspan>
    <tspan dx="28" fill="#0D9488">GH</tspan>
  </text>
  
  <!-- TAGLINE -->
  <text x="600" y="960" text-anchor="middle" fill="#1E3E62" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial', sans-serif" font-weight="800" font-size="28" letter-spacing="14">TRACK. ACHIEVE. EXCEL.</text>
</svg>
`

// ── 2. Vertical Emblem + Text (Pure White for Dark / Red Jerseys) ───────────
const svgVerticalWhite = `
<svg width="2400" height="2400" viewBox="0 0 1200 1200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tealBright" x1="280" y1="360" x2="880" y2="700" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2DD4BF"/>
      <stop offset="100%" stop-color="#14B8A6"/>
    </linearGradient>
  </defs>

  <!-- APEX ICON EMBLEM (Centered) -->
  <g transform="translate(60, 40)">
    <!-- Left Leg of A -->
    <path d="M510 150 H570 L390 670 H270 L510 150 Z" fill="#FFFFFF"/>
    
    <!-- Right Leg of A -->
    <path d="M570 150 L810 670 H690 L625 530 H510 L570 400 L570 150 Z" fill="#FFFFFF"/>

    <!-- Dynamic Flying Swoosh across A -->
    <path d="M270 670 C360 570 480 430 815 250 C720 380 610 510 420 620 C370 650 320 665 270 670 Z" fill="url(#tealBright)"/>
  </g>

  <!-- "APEXTRACK GH" WORDMARK -->
  <text x="600" y="890" text-anchor="middle" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="82" letter-spacing="4">
    <tspan fill="#FFFFFF">APEXTRACK</tspan>
    <tspan dx="28" fill="#2DD4BF">GH</tspan>
  </text>
  
  <!-- TAGLINE -->
  <text x="600" y="960" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.9" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial', sans-serif" font-weight="800" font-size="28" letter-spacing="14">TRACK. ACHIEVE. EXCEL.</text>
</svg>
`

// ── 3. Horizontal Jersey Back Sponsor Bar (White / Teal for Dark Kits) ───────
const svgHorizontalWhite = `
<svg width="4000" height="1200" viewBox="0 0 2000 600" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tealHBright" x1="100" y1="100" x2="350" y2="350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2DD4BF"/>
      <stop offset="100%" stop-color="#14B8A6"/>
    </linearGradient>
  </defs>

  <!-- Compact Emblem on Left -->
  <g transform="translate(80, 75) scale(0.65)">
    <path d="M370 50 H430 L250 570 H130 L370 50 Z" fill="#FFFFFF"/>
    <path d="M430 50 L670 570 H550 L485 430 H370 L430 300 L430 50 Z" fill="#FFFFFF"/>
    <path d="M130 570 C220 470 340 330 675 150 C580 280 470 410 280 520 C230 550 180 565 130 570 Z" fill="url(#tealHBright)"/>
  </g>

  <!-- Big Bold Jersey Back Wordmark -->
  <text x="590" y="340" fill="#FFFFFF" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="124" letter-spacing="6">
    <tspan fill="#FFFFFF">APEXTRACK</tspan>
    <tspan dx="36" fill="#2DD4BF">GH</tspan>
  </text>

  <!-- Subtitle -->
  <text x="595" y="415" fill="#FFFFFF" fill-opacity="0.85" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial', sans-serif" font-weight="800" font-size="28" letter-spacing="14">TRACK. ACHIEVE. EXCEL.</text>
</svg>
`

// ── 4. Horizontal Jersey Back Sponsor Bar (Dark Navy / Teal for Light Kits) ──
const svgHorizontalDark = `
<svg width="4000" height="1200" viewBox="0 0 2000 600" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="tealHDark" x1="100" y1="100" x2="350" y2="350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00A896"/>
      <stop offset="100%" stop-color="#0D9488"/>
    </linearGradient>
  </defs>

  <!-- Compact Emblem on Left -->
  <g transform="translate(80, 75) scale(0.65)">
    <path d="M370 50 H430 L250 570 H130 L370 50 Z" fill="#0B192C"/>
    <path d="M430 50 L670 570 H550 L485 430 H370 L430 300 L430 50 Z" fill="#0B192C"/>
    <path d="M130 570 C220 470 340 330 675 150 C580 280 470 410 280 520 C230 550 180 565 130 570 Z" fill="url(#tealHDark)"/>
  </g>

  <!-- Big Bold Jersey Back Wordmark -->
  <text x="590" y="340" fill="#0B192C" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="124" letter-spacing="6">
    <tspan fill="#0B192C">APEXTRACK</tspan>
    <tspan dx="36" fill="#0D9488">GH</tspan>
  </text>

  <!-- Subtitle -->
  <text x="595" y="415" fill="#1E3E62" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial', sans-serif" font-weight="800" font-size="28" letter-spacing="14">TRACK. ACHIEVE. EXCEL.</text>
</svg>
`

// ── 5. Wordmark Only (Pure White for Jersey Back Top) ────────────────────────
const svgWordmarkWhite = `
<svg width="4000" height="1000" viewBox="0 0 2000 500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="1000" y="280" text-anchor="middle" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="140" letter-spacing="6">
    <tspan fill="#FFFFFF">APEXTRACK</tspan>
    <tspan dx="42" fill="#2DD4BF">GH</tspan>
  </text>
  <text x="1000" y="375" text-anchor="middle" fill="#FFFFFF" fill-opacity="0.85" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial', sans-serif" font-weight="800" font-size="30" letter-spacing="16">TRACK. ACHIEVE. EXCEL.</text>
</svg>
`

// ── 6. Wordmark Only (Navy & Teal for White Jersey Back Top) ─────────────────
const svgWordmarkDark = `
<svg width="4000" height="1000" viewBox="0 0 2000 500" fill="none" xmlns="http://www.w3.org/2000/svg">
  <text x="1000" y="280" text-anchor="middle" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="140" letter-spacing="6">
    <tspan fill="#0B192C">APEXTRACK</tspan>
    <tspan dx="42" fill="#0D9488">GH</tspan>
  </text>
  <text x="1000" y="375" text-anchor="middle" fill="#1E3E62" font-family="system-ui, -apple-system, 'Plus Jakarta Sans', 'Montserrat', 'Arial', sans-serif" font-weight="800" font-size="30" letter-spacing="16">TRACK. ACHIEVE. EXCEL.</text>
</svg>
`

async function run() {
  console.log('Generating high-resolution transparent PNG and SVG assets for "APEXTRACK GH"...')

  // Save SVGs
  fs.writeFileSync(path.join(publicDir, 'apextrack-gh-vertical-color.svg'), svgVerticalFull.trim())
  fs.writeFileSync(path.join(publicDir, 'apextrack-gh-vertical-white.svg'), svgVerticalWhite.trim())
  fs.writeFileSync(path.join(publicDir, 'apextrack-gh-horizontal-white.svg'), svgHorizontalWhite.trim())
  fs.writeFileSync(path.join(publicDir, 'apextrack-gh-horizontal-dark.svg'), svgHorizontalDark.trim())
  fs.writeFileSync(path.join(publicDir, 'apextrack-gh-wordmark-white.svg'), svgWordmarkWhite.trim())
  fs.writeFileSync(path.join(publicDir, 'apextrack-gh-wordmark-dark.svg'), svgWordmarkDark.trim())

  // Render 300 DPI Transparent PNGs with Sharp
  await sharp(Buffer.from(svgVerticalFull))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apextrack-gh-jersey-vertical-color.png'))

  await sharp(Buffer.from(svgVerticalWhite))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apextrack-gh-jersey-vertical-white.png'))

  await sharp(Buffer.from(svgHorizontalWhite))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apextrack-gh-jersey-horizontal-white.png'))

  await sharp(Buffer.from(svgHorizontalDark))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apextrack-gh-jersey-horizontal-dark.png'))

  await sharp(Buffer.from(svgWordmarkWhite))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apextrack-gh-jersey-wordmark-white.png'))

  await sharp(Buffer.from(svgWordmarkDark))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(publicDir, 'apextrack-gh-jersey-wordmark-dark.png'))

  console.log('All 6 transparent jersey print PNGs & vector SVGs generated successfully!')
}

run().catch(console.error)
