'use client'

// app/global-error.jsx
// Root-level error boundary — catches fatal errors in the root layout itself.
// Must be a Client Component and include its own <html>/<body> tags.
import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Critical Error — ApexTrack</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0F2218 0%, #162E1E 50%, #1B3B26 100%);
            font-family: system-ui, -apple-system, sans-serif;
            padding: 24px;
          }
          .card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 20px;
            padding: 48px 40px;
            max-width: 520px;
            width: 100%;
            text-align: center;
            backdrop-filter: blur(12px);
            box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          }
          .icon-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: rgba(239,68,68,0.15);
            border: 1.5px solid rgba(239,68,68,0.3);
            margin-bottom: 28px;
            color: #FCA5A5;
          }
          h1 { font-size: 26px; font-weight: 800; color: #F0FDF4; margin-bottom: 12px; letter-spacing: -0.02em; }
          p  { font-size: 15px; color: rgba(240,253,244,0.6); line-height: 1.7; margin-bottom: 36px; }
          .btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
          button {
            background: linear-gradient(135deg, #0D9488, #0F766E);
            color: #fff;
            border: none;
            border-radius: 12px;
            padding: 13px 28px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(13,148,136,0.4);
          }
          a {
            display: inline-block;
            text-decoration: none;
            color: rgba(240,253,244,0.7);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 12px;
            padding: 13px 28px;
            font-size: 14px;
            font-weight: 600;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(13,148,136,0.12);
            border: 1px solid rgba(13,148,136,0.25);
            color: #5EEAD4;
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 20px;
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div className="icon-wrap">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="badge">⚠️ Critical Error</div>
          <h1>Something went seriously wrong</h1>
          <p>
            A critical error occurred that prevented the application from loading.
            This has been logged automatically. Our team will investigate shortly.
          </p>
          <div className="btns">
            <button onClick={() => reset()}>Try Again</button>
            <a href="/dashboard">Go to Dashboard</a>
          </div>
        </div>
      </body>
    </html>
  )
}
