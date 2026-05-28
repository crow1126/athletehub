'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const NAV_LINKS = ['Features', 'Pricing', 'FAQ', 'Support']

const FEATURES = [
  { emoji: '📊', title: 'Performance Analytics', desc: 'xG, xA, match ratings, and squad-level trend views with beautiful charts.' },
  { emoji: '🏥', title: 'Injury Hub', desc: 'Full injury lifecycle — onset, treatment, recovery timeline, and return-to-play clearance.' },
  { emoji: '👥', title: 'Squad Management', desc: 'Complete athlete registry with positions, physical data, and coach assignments.' },
  { emoji: '📅', title: 'Training Scheduler', desc: 'Session planner with type categorisation, venue booking, and duration tracking.' },
  { emoji: '🔍', title: 'Scouting Module', desc: 'Prospect tracking, trial management, and comparison tools for transfers.' },
  { emoji: '📄', title: 'Reports', desc: 'Automated performance and medical reports for board and technical staff.' },
  { emoji: '💬', title: 'Dedicated Support', desc: 'Direct technical assistance and custom onboarding support via active email admin@apextrackgh.com.' },
]

const STATS = [
  { value: '40+', label: 'Clubs Onboarded' },
  { value: '2,000+', label: 'Athletes Tracked' },
  { value: '14k+', label: 'Matches Logged' },
  { value: '94%', label: 'Recovery Rate' },
]

const LOGOS = [
  { name: 'GFA', style: { fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em' } },
  { name: 'CAF', style: { fontWeight: 800, fontSize: 20, letterSpacing: '0.08em' } },
  { name: 'Premier League', style: { fontWeight: 700, fontSize: 15 } },
  { name: 'Ghana Stars FC', style: { fontWeight: 900, fontSize: 16, letterSpacing: '-0.02em' } },
  { name: 'Accra Lions', style: { fontWeight: 800, fontSize: 17 } },
]

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        body {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          background: #FFFFFF;
          color: #0F172A;
          overflow-x: hidden;
        }

        /* ── KEYFRAMES ── */
        @keyframes fadeUp   { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes float0   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-10px)} }
        @keyframes float1   { 0%,100%{transform:translateY(-6px)} 50%{transform:translateY(6px)} }
        @keyframes float2   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes marquee  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

        /* ── NAVBAR ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 72px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          transition: box-shadow 0.3s, height 0.3s;
        }
        .lp-nav.scrolled {
          box-shadow: 0 1px 0 rgba(0,0,0,0.07), 0 4px 20px rgba(0,0,0,0.04);
          height: 60px;
        }
        .nav-brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none;
        }
        .nav-brand-img {
          height: 38px; width: auto; border-radius: 8px; object-fit: contain;
        }
        .nav-brand-name {
          font-size: 18px; font-weight: 800; color: #0F172A;
          letter-spacing: -0.03em;
        }
        .nav-brand-name span { color: #0D9488; }

        .nav-links-center {
          display: flex; align-items: center; gap: 36px;
          position: absolute; left: 50%; transform: translateX(-50%);
        }
        .nav-link {
          font-size: 14px; font-weight: 600; color: #475569;
          text-decoration: none; background: none; border: none;
          cursor: pointer; font-family: inherit;
          transition: color 0.2s;
          display: flex; align-items: center; gap: 4px;
        }
        .nav-link:hover { color: #0F172A; }
        .nav-link-arrow { font-size: 10px; opacity: 0.5; }

        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-pricing {
          font-size: 14px; font-weight: 600; color: #475569;
          text-decoration: none; transition: color 0.2s;
        }
        .nav-pricing:hover { color: #0F172A; }
        .nav-cta {
          background: #0F172A; color: #fff;
          border: none; border-radius: 99px;
          padding: 10px 22px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.2s; text-decoration: none;
          display: inline-flex; align-items: center;
        }
        .nav-cta:hover { background: #1E293B; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,23,42,0.18); }
        .nav-hamburger {
          display: none; background: none; border: none;
          cursor: pointer; color: #0F172A; font-size: 22px; padding: 4px;
        }

        /* ── MOBILE MENU ── */
        .mobile-menu {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(255,255,255,0.98); backdrop-filter: blur(16px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.2s ease;
        }
        .mobile-menu-close {
          position: absolute; top: 20px; right: 20px;
          background: none; border: none; font-size: 28px;
          cursor: pointer; color: #0F172A;
        }
        .mobile-menu-link {
          font-size: 24px; font-weight: 700; color: #0F172A;
          text-decoration: none; background: none; border: none;
          cursor: pointer; font-family: inherit;
        }

        /* ── HERO ── */
        .hero {
          padding: 148px 48px 0;
          text-align: center;
          background: #FFFFFF;
          position: relative;
          overflow: hidden;
        }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          border-radius: 99px; padding: 5px 14px 5px 8px;
          margin-bottom: 28px;
          opacity: 0; animation: fadeUp 0.6s ease 0.2s forwards;
        }
        .hero-eyebrow-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #14B8A6; animation: float0 2s ease-in-out infinite;
        }
        .hero-eyebrow-text {
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #0D9488;
        }
        .hero-h1 {
          font-size: clamp(44px, 7vw, 88px);
          font-weight: 800; line-height: 1.04;
          letter-spacing: -0.03em; color: #0F172A;
          margin-bottom: 22px; max-width: 760px; margin-left: auto; margin-right: auto;
          opacity: 0; animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s forwards;
        }
        .hero-sub {
          font-size: clamp(15px, 1.8vw, 18px); line-height: 1.65;
          color: #64748B; max-width: 540px; margin: 0 auto 36px;
          font-weight: 500;
          opacity: 0; animation: fadeUp 0.8s ease 0.45s forwards;
        }
        .hero-btns {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; flex-wrap: wrap;
          opacity: 0; animation: fadeUp 0.7s ease 0.6s forwards;
        }
        .btn-primary {
          background: #0F172A; color: #fff;
          border: none; border-radius: 99px;
          padding: 15px 32px; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.22s;
          box-shadow: 0 8px 24px rgba(15,23,42,0.15);
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(15,23,42,0.22); background: #1E293B; }
        .btn-outline {
          background: transparent; color: #0F172A;
          border: 1.5px solid #CBD5E1; border-radius: 99px;
          padding: 15px 32px; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.22s;
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .btn-outline:hover { border-color: #94A3B8; background: #F8FAFC; transform: translateY(-2px); }

        /* ── HERO IMAGE BOX ── */
        .hero-visual {
          position: relative;
          margin: 48px auto 0;
          max-width: 960px;
          border-radius: 24px 24px 0 0;
          overflow: hidden;
          opacity: 0; animation: fadeUp 0.9s ease 0.75s forwards;
        }
        .hero-img {
          width: 100%; display: block;
          border-radius: 24px 24px 0 0;
        }

        /* Floating stat cards on the hero image */
        .hf-card {
          position: absolute;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(0,0,0,0.07);
          backdrop-filter: blur(12px);
          border-radius: 14px; padding: 11px 15px;
          display: flex; align-items: center; gap: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          white-space: nowrap;
        }
        .hf-icon {
          width: 34px; height: 34px; border-radius: 9px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .hf-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94A3B8; }
        .hf-val   { font-size: 16px; font-weight: 800; color: #0F172A; line-height: 1; }
        .hf-badge {
          display: inline-flex; align-items: center; gap: 4px;
          background: #F0FDF4; border: 1px solid #BBF7D0;
          border-radius: 99px; padding: 3px 9px;
          font-size: 10px; font-weight: 700; color: #16A34A;
        }

        /* ── LOGOS STRIP ── */
        .logos-strip {
          padding: 52px 0 48px;
          background: #FFFFFF;
          border-bottom: 1px solid #F1F5F9;
        }
        .logos-label {
          text-align: center;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #94A3B8; margin-bottom: 28px;
        }
        .logos-track-wrap { overflow: hidden; }
        .logos-track {
          display: flex; align-items: center; gap: 64px;
          animation: marquee 22s linear infinite;
          width: max-content;
        }
        .logo-item {
          color: #CBD5E1;
          transition: color 0.2s;
          cursor: default;
          user-select: none;
        }
        .logo-item:hover { color: #94A3B8; }

        /* ── FEATURES ── */
        .features-section {
          padding: 96px 48px;
          background: #FAFAFA;
        }
        .section-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          margin-bottom: 14px;
        }
        .eyebrow-line { width: 22px; height: 2px; background: linear-gradient(90deg,#14B8A6,#0D9488); border-radius: 2px; }
        .eyebrow-text { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #0D9488; }
        .section-title {
          font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
          color: #0F172A; letter-spacing: -0.025em; margin-bottom: 12px;
        }
        .section-sub {
          font-size: 15px; color: #64748B; line-height: 1.75;
          max-width: 480px; margin-bottom: 52px;
        }
        .features-grid {
          max-width: 1100px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .feat-card {
          background: #FFFFFF; border: 1px solid #E2E8F0;
          border-radius: 18px; padding: 28px 24px;
          transition: all 0.22s ease;
        }
        .feat-card:hover {
          border-color: #99F6E4;
          box-shadow: 0 8px 32px rgba(13,148,136,0.1);
          transform: translateY(-3px);
        }
        .feat-icon {
          width: 46px; height: 46px; border-radius: 13px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 18px;
        }
        .feat-title { font-size: 15px; font-weight: 700; color: #0F172A; margin-bottom: 8px; }
        .feat-desc  { font-size: 13px; color: #64748B; line-height: 1.7; }

        /* ── STATS BAND ── */
        .stats-band {
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          padding: 64px 48px;
        }
        .stats-grid {
          max-width: 960px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4,1fr); gap: 0;
          text-align: center;
        }
        .stat-col { padding: 0 24px; }
        .stat-col + .stat-col { border-left: 1px solid rgba(255,255,255,0.1); }
        .stat-val { font-size: clamp(36px,4vw,56px); font-weight: 900; color: #fff; letter-spacing: -0.03em; line-height: 1; margin-bottom: 8px; }
        .stat-lbl { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.45); letter-spacing: 0.05em; text-transform: uppercase; }

        /* ── CTA SECTION ── */
        .cta-section {
          padding: 96px 48px;
          background: #FFFFFF;
          text-align: center;
        }
        .cta-box {
          max-width: 680px; margin: 0 auto;
          background: linear-gradient(135deg, #F0FDFA, #ECFDF5);
          border: 1px solid #CCFBF1; border-radius: 28px;
          padding: 56px 48px;
        }
        .cta-title { font-size: clamp(28px,3.5vw,40px); font-weight: 800; color: #0F172A; letter-spacing: -0.025em; margin-bottom: 14px; }
        .cta-sub   { font-size: 15px; color: #64748B; line-height: 1.7; margin-bottom: 32px; }
        .cta-btns  { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }

        /* ── FOOTER ── */
        .footer {
          background: #0F172A; padding: 48px 48px 32px;
        }
        .footer-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 20px;
          padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .footer-brand { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.025em; }
        .footer-brand span { color: #14B8A6; }
        .footer-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .footer-link { font-size: 13px; color: rgba(255,255,255,0.4); text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .footer-link:hover { color: rgba(255,255,255,0.8); }
        .footer-copy { text-align: center; font-size: 12px; color: rgba(255,255,255,0.2); margin-top: 20px; max-width: 1100px; margin-left: auto; margin-right: auto; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .nav-links-center { display: none; }
          .nav-hamburger { display: block; }
          .features-grid { grid-template-columns: repeat(2,1fr); }
          .stats-grid { grid-template-columns: repeat(2,1fr); gap: 28px; }
          .stat-col + .stat-col { border-left: none; }
          .stat-col:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.1); }
        }
        @media (max-width: 640px) {
          .lp-nav { padding: 0 20px; }
          .hero { padding: 120px 20px 0; }
          .hero-visual { margin: 36px 16px 0; border-radius: 16px 16px 0 0; }
          .hero-img { border-radius: 16px 16px 0 0; }
          .hf-card { display: none; }
          .features-section { padding: 64px 20px; }
          .features-grid { grid-template-columns: 1fr; }
          .stats-band { padding: 52px 20px; }
          .cta-section { padding: 64px 20px; }
          .cta-box { padding: 36px 24px; }
          .footer { padding: 36px 20px 24px; }
          .footer-inner { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-close" onClick={() => setMenuOpen(false)}>×</button>
          {NAV_LINKS.map(l => (
            <button key={l} className="mobile-menu-link" onClick={() => scrollTo(l.toLowerCase())}>{l}</button>
          ))}
          <Link href="/login" className="btn-primary" style={{ padding: '14px 36px', fontSize: 16 }}>
            Get Started
          </Link>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <a className="nav-brand" href="/">
          <img src="/logo.png" alt="ApexTrack" className="nav-brand-img" />
          <span className="nav-brand-name">Apex<span>Track</span></span>
        </a>

        <div className="nav-links-center">
          {NAV_LINKS.map(l => (
            <button key={l} className="nav-link" onClick={() => scrollTo(l.toLowerCase())}>
              {l} <span className="nav-link-arrow">▾</span>
            </button>
          ))}
        </div>

        <div className="nav-right">
          <Link href="/login" className="nav-pricing">Pricing</Link>
          <Link href="/login" className="nav-cta">Get Started</Link>
          <button className="nav-hamburger" onClick={() => setMenuOpen(true)}>☰</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero" id="features">
        {/* Eyebrow */}
        <div className="hero-eyebrow">
          <div className="hero-eyebrow-dot" />
          <span className="hero-eyebrow-text">Football Performance Platform</span>
        </div>

        {/* Headline */}
        <h1 className="hero-h1">
          The Leading<br />
          Football Management<br />
          Platform
        </h1>

        {/* Subtext */}
        <p className="hero-sub">
          Manage squads, track athlete performance, and prevent injuries — all in one place. Built for clubs across Africa.
        </p>

        {/* CTA Buttons */}
        <div className="hero-btns">
          <Link href="/login?tab=signup" className="btn-primary">
            Get Started — It&apos;s Free
          </Link>
          <Link href="/login" className="btn-outline">
            Sign In — Dashboard
          </Link>
        </div>

        {/* Hero visual */}
        <div className="hero-visual">
          <img src="/hero-light.png" alt="ApexTrack dashboard preview" className="hero-img" />

          {/* Floating cards */}
          <div className="hf-card" style={{ top: '18%', left: '3%', animation: 'float0 3.6s ease-in-out infinite' }}>
            <div className="hf-icon">👥</div>
            <div>
              <div className="hf-label">Active Athletes</div>
              <div className="hf-val">248 <span className="hf-badge">↑ 12 New</span></div>
            </div>
          </div>

          <div className="hf-card" style={{ top: '55%', left: '2%', animation: 'float1 4.2s ease-in-out 0.4s infinite' }}>
            <div className="hf-icon">📊</div>
            <div>
              <div className="hf-label">Avg Match Rating</div>
              <div className="hf-val">7.4</div>
            </div>
          </div>

          <div className="hf-card" style={{ top: '24%', right: '3%', animation: 'float2 3.9s ease-in-out 0.7s infinite' }}>
            <div className="hf-icon">🤖</div>
            <div>
              <div className="hf-label">Co-Pilot</div>
              <div className="hf-val" style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>AI · Live</div>
            </div>
          </div>

          <div className="hf-card" style={{ top: '58%', right: '2%', animation: 'float0 4s ease-in-out 1s infinite' }}>
            <div className="hf-icon">🏥</div>
            <div>
              <div className="hf-label">Recovery Rate</div>
              <div className="hf-val">94% <span className="hf-badge">Secure</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS STRIP ── */}
      <div className="logos-strip">
        <div className="logos-label">Trusted by clubs across Africa</div>
        <div className="logos-track-wrap">
          <div className="logos-track">
            {[...LOGOS, ...LOGOS].map((logo, i) => (
              <div key={i} className="logo-item" style={logo.style}>{logo.name}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="features-section" id="pricing">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="section-eyebrow">
            <div className="eyebrow-line" />
            <span className="eyebrow-text">Platform</span>
          </div>
          <h2 className="section-title">Everything your club needs</h2>
          <p className="section-sub">
            Built for Ghanaian and African football — from grassroots academies to professional clubs.
          </p>
          <div className="features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feat-card">
                <div className="feat-icon">{f.emoji}</div>
                <div className="feat-title">{f.title}</div>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div className="stats-band" id="faq">
        <div className="stats-grid">
          {STATS.map(s => (
            <div key={s.label} className="stat-col">
              <div className="stat-val">{s.value}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <section className="cta-section" id="support">
        <div className="cta-box">
          <h2 className="cta-title">Ready to elevate your squad?</h2>
          <p className="cta-sub">
            Join 40+ clubs already managing athletes smarter with ApexTrack.
            Start your free trial today — no credit card required.
          </p>
          <div className="cta-btns">
            <Link href="/login?tab=signup" className="btn-primary">Start Free Trial →</Link>
            <Link href="/login" className="btn-outline">Sign In</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">Apex<span>Track</span></div>
          <div className="footer-links">
            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
            <Link href="/terms" className="footer-link">Terms of Service</Link>
            <Link href="/security" className="footer-link">Security</Link>
            <Link href="/login" className="footer-link">Sign In</Link>
          </div>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} ApexTrack. All rights reserved.</div>
      </footer>
    </>
  )
}
