import { NextResponse } from 'next/server'

const APK_URL = 'https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack.apk'

export async function GET() {
  try {
    const probe = await fetch(APK_URL, {
      method: 'HEAD',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    // Only redirect if the target file actually exists and returns HTTP 200/302
    if (probe.ok && (probe.status === 200 || probe.status === 302)) {
      return NextResponse.redirect(APK_URL, 302)
    }
  } catch (err) {
    console.error('APK probe error:', err)
  }

  // Branded fallback page with helpful Android install steps & live retry
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>ApexTrack Android APK Download</title>
  <link rel="icon" href="/logo.png"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #F8FAFC;
      color: #0F172A;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.06);
    }
    .logo { width: 68px; height: 68px; border-radius: 16px; margin-bottom: 18px; object-fit: contain; }
    h1 { font-size: 22px; font-weight: 800; margin: 0 0 10px; color: #0F172A; letter-spacing: -0.02em; }
    p { font-size: 14px; color: #64748B; line-height: 1.6; margin: 0 0 20px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #ECFDF5;
      color: #059669;
      border: 1px solid #A7F3D0;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .btn {
      display: block;
      width: 100%;
      background: #059669;
      color: #fff;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 12px;
      transition: all 0.2s;
    }
    .btn:hover { background: #047857; transform: translateY(-1px); }
    .btn-sec {
      display: block;
      width: 100%;
      background: #F1F5F9;
      color: #334155;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .steps-box {
      text-align: left;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 16px;
      margin-top: 20px;
    }
    .steps-title { font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
    .step-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #475569; margin-bottom: 8px; line-height: 1.45; }
    .step-num { width: 18px; height: 18px; border-radius: 50%; background: #0D9488; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="/logo.png" alt="ApexTrack" class="logo"/>
    <div class="badge"><div class="dot"></div> Android Package Packaging</div>
    <h1>ApexTrack for Android</h1>
    <p>The native Android APK release (v1.0.5) is finalizing in our cloud build pipeline. You can retry the download below or access the mobile app immediately in your browser.</p>
    
    <a href="${APK_URL}" class="btn" download="ApexTrack.apk">Direct APK Download</a>
    <a href="/" class="btn-sec">Return to ApexTrack Home</a>

    <div class="steps-box">
      <div class="steps-title">Quick Installation Steps</div>
      <div class="step-item">
        <div class="step-num">1</div>
        <div>Tap <strong>Direct APK Download</strong> above. If prompted with a warning, select <em>Download anyway</em>.</div>
      </div>
      <div class="step-item">
        <div class="step-num">2</div>
        <div>Once downloaded, tap the file in your notification bar or Downloads folder.</div>
      </div>
      <div class="step-item">
        <div class="step-num">3</div>
        <div>Select <em>Install</em> (allow unknown apps if asked). Launch and log into your club!</div>
      </div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
