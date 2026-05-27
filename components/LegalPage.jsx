import Link from 'next/link'

const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/security', label: 'Security & Data Protection' },
]

export default function LegalPage({ title, subtitle, lastUpdated, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#001E1E', color: '#FFFCF6', fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,252,246,0.08)', padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
          <img src="/logo.png" alt="Apex Track" style={{ height: 36, width: 'auto', borderRadius: 8 }} />
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Apex <span style={{ color: '#7ECACA', fontWeight: 400 }}>Track</span>
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,252,246,0.5)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 40px 80px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#14B8A6', marginBottom: 12 }}>Legal</p>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 10, lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 15, color: 'rgba(255,252,246,0.55)', marginBottom: 8, lineHeight: 1.6 }}>{subtitle}</p>}
        {lastUpdated && <p style={{ fontSize: 12, color: 'rgba(255,252,246,0.35)', marginBottom: 36 }}>Last updated: {lastUpdated}</p>}

        <article className="legal-prose" style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,252,246,0.78)' }}>
          {children}
        </article>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,252,246,0.08)' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,252,246,0.4)', marginBottom: 12 }}>Related documents</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} style={{ fontSize: 13, fontWeight: 600, color: '#7ECACA', textDecoration: 'none' }}>
                {l.label} →
              </Link>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,252,246,0.3)', marginTop: 24 }}>
            Questions? Contact{' '}
            <a href="mailto:privacy@apextrack.app" style={{ color: '#7ECACA' }}>privacy@apextrack.app</a>
          </p>
        </div>
      </main>

      <style>{`
        .legal-prose h2 { font-size: 18px; font-weight: 700; color: #FFFCF6; margin: 32px 0 12px; }
        .legal-prose h3 { font-size: 15px; font-weight: 700; color: rgba(255,252,246,0.9); margin: 24px 0 8px; }
        .legal-prose p { margin: 0 0 14px; }
        .legal-prose ul, .legal-prose ol { margin: 0 0 14px; padding-left: 22px; }
        .legal-prose li { margin-bottom: 6px; }
        .legal-prose a { color: #7ECACA; }
        @media (max-width: 640px) {
          main { padding: 32px 20px 60px !important; }
          header { padding: 16px 20px !important; }
        }
      `}</style>
    </div>
  )
}
