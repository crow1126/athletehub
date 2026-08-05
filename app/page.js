'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconMenu, IconCheck } from '@/lib/icons'

const NAV_LINKS = ['Features', 'Pricing', 'Download', 'FAQ', 'Support']

const FEATURES = [
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 16.5l5.5-5.5 4.5 4.5 8-8" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M17 7h4v4" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="8.5" cy="11" r="2.5" fill="#CCFBF1" stroke="#0D9488" strokeWidth="1.5"/>
      </svg>
    ), 
    title: 'Football Performance Analytics', 
    desc: 'Track match statistics for your squad — goals, assists, yellow/red cards, and minutes played. View form trends to optimize matchday strategy.' 
  },
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="#0D9488" strokeWidth="2"/>
        <path d="M12 7v10M7 12h10" stroke="#0D9488" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ), 
    title: 'Comprehensive Injury Hub', 
    desc: 'Maintain detailed medical logs for player injuries, recovery progress, and rehabilitation steps. Set expected return-to-play timelines safely.' 
  },
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="7" r="4" stroke="#0D9488" strokeWidth="2"/>
        <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#0D9488" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ), 
    title: 'Club & Roster Management', 
    desc: 'Manage your entire club roster, technical staff, and player registry. Position breakdown tailored for football (GK / DF / MF / FW).' 
  },
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="#0D9488" strokeWidth="2"/>
        <path d="M3 10h18M8 2v4M16 2v4" stroke="#0D9488" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="7" cy="14" r="1" fill="#0D9488"/>
        <circle cx="12" cy="14" r="1" fill="#0D9488"/>
        <circle cx="17" cy="14" r="1" fill="#0D9488"/>
      </svg>
    ), 
    title: 'Training & Session Planner', 
    desc: 'Schedule and organize training sessions. Categorize workouts by focus area, manage pitch locations, and assign coaches to lead specific squads.' 
  },
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="6" stroke="#0D9488" strokeWidth="2"/>
        <path d="M20 20l-4.5-4.5" stroke="#0D9488" strokeWidth="2" strokeLinecap="round"/>
        <path d="M9 11h4M11 9v4" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ), 
    title: 'Scouting & Transfer Board', 
    desc: 'Register trialists, track promising scouting targets, and keep historical transfer records to ensure your team never misses out on emerging talent.' 
  },
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16v16H4V4z" stroke="#0D9488" strokeWidth="2" strokeLinejoin="round"/>
        <path d="M8 8h8M8 12h8M8 16h5" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ), 
    title: 'Automated Reports', 
    desc: 'Generate complete performance reviews, attendance summaries, and medical logs. Prepare professional print-ready files and clean reports for management review.' 
  },
  { 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 8l9 6 9-6M21 5v14H3V5" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ), 
    title: 'Dedicated Support', 
    desc: (
      <span>
        Receive hands-on onboarding assistance and active technical help from our support team. Connect directly via email at{' '}
        <a href="mailto:admin@apextrackgh.com" className="feat-link">
          admin@apextrackgh.com
        </a>.
      </span>
    )
  },
]

const STATS = [
  { value: '60+', label: 'Clubs Onboarded' },
  { value: '3,500+', label: 'Athletes Tracked' },
  { value: '20k+', label: 'Matches Logged' },
  { value: '96%', label: 'Satisfaction Rate' },
]

const LOGOS = [
  { name: 'GFA', style: { fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em' } },
  { name: 'CAF', style: { fontWeight: 800, fontSize: 20, letterSpacing: '0.08em' } },
  { name: 'Premier League', style: { fontWeight: 700, fontSize: 15 } },
  { name: 'Accra Lions', style: { fontWeight: 800, fontSize: 17 } },
  { name: 'Asante Kotoko SC', style: { fontWeight: 800, fontSize: 16 } },
]

const FAQS = [
  {
    q: 'What is Apex Track?',
    a: 'Apex Track is an all-in-one football management software built for football clubs, academies, and technical teams in Ghana and across Africa to streamline squad tracking, medical logs, match performance, and payroll.'
  },
  {
    q: 'How secure is our club and athlete database?',
    a: 'ApexTrack uses Postgres Row Level Security (RLS) and TLS encryption to fully isolate your squad data. Only authorized coaches and administrators within your specific club can access athlete and injury records — no cross-club data leakage is possible.'
  },
  {
    q: 'What is ApexPay and which plan includes it?',
    a: 'ApexPay is our built-in club payroll system. It allows administrators to manage staff salaries, run payroll cycles, top up a club wallet via Mobile Money (MoMo), and disburse funds to players and staff — all within the platform. ApexPay is exclusively included in the Captain plan.'
  },
  {
    q: 'Is there a limit on how many players or coaches we can add?',
    a: 'Starting XI clubs can manage up to 40 active player profiles. Captain plan clubs enjoy unlimited player and staff registrations with no cap on squad size.'
  },
  {
    q: 'How do we request custom feature additions or onboarding support?',
    a: 'We provide full custom setup, data migration, and roster import support. Drop us an email at admin@apextrackgh.com and our engineering team will assist your club — free of charge.'
  },
  {
    q: 'Can we export reports for club executives or board members?',
    a: 'Yes. ApexTrack lets you generate professional PDF performance sheets, medical summaries, transfer history reports, and payroll summaries in just a few clicks — ready for board-level review.'
  }
]

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState(null)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll)
    if (typeof window !== 'undefined' && (window.electronAPI?.isElectron || navigator.userAgent.includes('Electron'))) {
      setIsElectron(true)
    }
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollTo(id) {
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: 'smooth' })
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
          background-color: #FFFFFF;
          background-image:
            radial-gradient(ellipse at 0% 0%, rgba(180, 220, 180, 0.45) 0%, transparent 55%),
            radial-gradient(ellipse at 5% 80%, rgba(180, 215, 175, 0.3) 0%, transparent 45%),
            radial-gradient(ellipse at 30% 30%, rgba(200, 230, 200, 0.25) 0%, transparent 50%),
            linear-gradient(to right, rgba(195, 225, 190, 0.3) 0%, rgba(220, 240, 220, 0.1) 40%, #FFFFFF 70%);
          background-attachment: fixed;
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
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          transition: box-shadow 0.3s, height 0.3s;
        }
        .lp-nav.scrolled {
          box-shadow: 0 1px 0 rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.04);
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
        .nav-pricing-btn {
          font-size: 14px; font-weight: 600; color: #475569;
          background: none; border: none; cursor: pointer;
          font-family: inherit; transition: color 0.2s;
          text-decoration: none;
        }
        .nav-pricing-btn:hover { color: #0F172A; }
        .nav-cta {
          background: #0F172A; color: #FFFFFF;
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
          background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(16px);
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
          background: transparent;
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
          max-width: 1100px;
          overflow: hidden;
          opacity: 0; animation: fadeUp 0.9s ease 0.75s forwards;
        }
        .hero-img-wrapper {
          position: relative;
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(13,148,136,0.1);
        }
        .hero-img {
          width: 100%; display: block;
          height: 520px;
          object-fit: cover;
          object-position: center 30%;
          filter: contrast(1.08) brightness(0.95);
        }
        .hero-img-overlay {
          position: absolute; inset: 0;
          background: 
            linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(15,23,42,0.7) 100%),
            linear-gradient(135deg, rgba(13,148,136,0.18) 0%, rgba(20,184,166,0.08) 50%, transparent 100%);
          border-radius: 28px;
          pointer-events: none;
        }
        .hero-img-accent {
          position: absolute; bottom: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, #0D9488, #14B8A6, #2DD4BF, #14B8A6, #0D9488);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer { 0%{background-position:100% 0} 50%{background-position:0% 0} 100%{background-position:100% 0} }

        /* ── FEATURES ── */
        .features-section {
          padding: 96px 48px;
          background: transparent;
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
          background: rgba(255, 255, 255, 0.7); border: 1px solid #E2E8F0;
          backdrop-filter: blur(8px);
          border-radius: 18px; padding: 28px 24px;
          transition: all 0.22s ease;
        }
        .feat-card:hover {
          border-color: #99F6E4;
          box-shadow: 0 8px 32px rgba(13,148,136,0.08);
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
        .feat-link { color: #0D9488; text-decoration: underline; font-weight: 600; }
        .feat-link:hover { color: #0F766E; }

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

        /* ── PRICING SECTION ── */
        .pricing-section {
          padding: 96px 48px;
          background: transparent;
        }
        .pricing-grid {
          max-width: 900px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
          align-items: stretch;
        }
        .price-card {
          background: rgba(255, 255, 255, 0.7); border: 1px solid #E2E8F0;
          backdrop-filter: blur(8px);
          border-radius: 24px; padding: 40px;
          display: flex; flex-direction: column; justify-content: space-between;
          position: relative; transition: all 0.25s ease;
        }
        .price-card.featured {
          border-color: #0D9488;
          box-shadow: 0 12px 40px rgba(13,148,136,0.08);
        }
        .price-badge {
          position: absolute; top: 20px; right: 20px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          color: #0D9488; font-size: 11px; font-weight: 700;
          padding: 4px 12px; border-radius: 99px; text-transform: uppercase;
        }
        .price-tier { font-size: 18px; font-weight: 800; color: #0F172A; margin-bottom: 8px; }
        .price-desc { font-size: 13px; color: #64748B; line-height: 1.5; margin-bottom: 24px; }
        .price-amount { font-size: 40px; font-weight: 900; color: #0F172A; display: flex; align-items: baseline; gap: 4px; margin-bottom: 28px; }
        .price-amount span { font-size: 14px; font-weight: 600; color: #94A3B8; }
        .price-features { list-style: none; display: flex; flex-direction: column; gap: 14px; margin-bottom: 36px; }
        .price-feat-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #475569; font-weight: 500; }
        .price-feat-check { width: 18px; height: 18px; border-radius: 50%; background: #F0FDFA; border: 1px solid #CCFBF1; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #0D9488; flex-shrink: 0; }
        
        .price-btn {
          width: 100%; text-align: center; padding: 14px;
          border-radius: 12px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.2s;
          text-decoration: none; display: block; box-sizing: border-box;
        }
        .price-btn.primary { background: #0D9488; color: #FFFFFF; border: none; box-shadow: 0 4px 14px rgba(13,148,136,0.2); }
        .price-btn.primary:hover { background: #0F766E; transform: translateY(-1px); }
        .price-btn.outline { background: transparent; color: #0F172A; border: 1.5px solid #E2E8F0; }
        .price-btn.outline:hover { border-color: #94A3B8; background: #F8FAFC; transform: translateY(-1px); }

        /* ── FAQ SECTION ── */
        .faq-section {
          padding: 96px 48px;
          background: transparent;
        }
        .faq-list { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .faq-item { background: rgba(255, 255, 255, 0.7); border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; transition: all 0.2s ease; }
        .faq-item:hover { border-color: #CBD5E1; }
        .faq-trigger {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 24px; background: none; border: none; text-align: left;
          font-size: 16px; font-weight: 700; color: #0F172A; cursor: pointer;
          font-family: inherit; transition: color 0.15s;
        }
        .faq-trigger:hover { color: #0D9488; }
        .faq-icon { font-size: 14px; color: #94A3B8; transition: transform 0.2s ease; }
        .faq-item.active .faq-icon { transform: rotate(180deg); color: #0D9488; }
        .faq-content { padding: 0 24px 24px; font-size: 14px; color: #64748B; line-height: 1.65; display: none; }
        .faq-item.active .faq-content { display: block; animation: fadeIn 0.3s ease; }

        /* ── DOWNLOAD SECTION (EDITORIAL ART STYLE) ── */
        .download-section {
          padding: 96px 48px;
          background: transparent;
          position: relative;
        }
        .dl-hero-card {
          max-width: 1100px; margin: 0 auto;
          background: linear-gradient(135deg, #F2FAF1 0%, #E2F4E1 35%, #ECF8EA 70%, #F8FCF8 100%);
          border-radius: 36px;
          border: 1px solid rgba(13, 148, 136, 0.2);
          padding: 0;
          overflow: hidden;
          position: relative;
          box-shadow: 0 32px 90px rgba(13, 148, 136, 0.08), 0 4px 20px rgba(0, 0, 0, 0.02);
        }
        .dl-hero-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, #0D9488, #10B981, #34D399, #10B981, #0D9488);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        .dl-top-bar {
          display: flex; justify-content: space-between; align-items: center;
          padding: 32px 48px 0;
        }
        .dl-top-brand {
          font-size: 13px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em;
          display: flex; align-items: center; gap: 8px;
        }
        .dl-top-brand span { color: #0D9488; }
        .dl-top-badge {
          background: #E0F2FE; border: 1px solid #BAE6FD;
          color: #0369A1; font-size: 11px; font-weight: 700;
          padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.06em;
        }

        .dl-inner {
          position: relative; z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          min-height: 480px;
        }
        .dl-left {
          padding: 40px 48px 48px;
          display: flex; flex-direction: column; justify-content: center;
        }
        .dl-greeting {
          font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .dl-greeting-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #10B981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
        }
        .dl-headline-editorial {
          font-size: clamp(34px, 3.8vw, 52px);
          font-weight: 900; color: #0F172A;
          letter-spacing: -0.035em; line-height: 1.05;
          margin-bottom: 16px;
        }
        .dl-headline-editorial span.highlight-dot {
          color: #0D9488;
        }
        .dl-sub-editorial {
          font-size: 15px; color: #475569;
          line-height: 1.6; margin-bottom: 32px; max-width: 440px;
          font-weight: 500;
        }
        .dl-cta-row {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        }
        .dl-btn-primary {
          background: #0D9488; color: #FFFFFF;
          border: none; border-radius: 10px;
          padding: 16px 36px; font-size: 15px; font-weight: 800;
          cursor: pointer; font-family: inherit;
          text-decoration: none; display: inline-flex; align-items: center; gap: 10px;
          transition: all 0.22s ease;
          box-shadow: 0 10px 28px rgba(13, 148, 136, 0.25);
          width: fit-content;
        }
        .dl-btn-primary:hover {
          background: #0F766E;
          transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(13, 148, 136, 0.35);
        }

        .dl-platforms-minimal {
          display: flex; align-items: center; gap: 12px; margin-top: 32px; flex-wrap: wrap;
        }
        .dl-platform-pill {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 700; color: #475569;
          background: rgba(255, 255, 255, 0.85);
          padding: 6px 14px; border-radius: 99px; border: 1px solid rgba(13, 148, 136, 0.15);
        }
        .dl-platform-pill.active {
          color: #0F172A; border-color: #0D9488; background: #FFFFFF;
          box-shadow: 0 2px 8px rgba(13, 148, 136, 0.1);
        }
        .dl-platform-pill.disabled { opacity: 0.55; }

        /* RIGHT EDITORIAL ART PIECE */
        .dl-right-art {
          position: relative;
          padding: 28px 40px;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .dl-art-giant-logo {
          position: absolute;
          width: 320px; height: auto;
          max-height: 320px; object-fit: contain;
          z-index: 0;
          right: -20px; bottom: -20px;
          opacity: 0.1;
          filter: drop-shadow(0 12px 36px rgba(13, 148, 136, 0.2));
          pointer-events: none;
          user-select: none;
        }
        .dl-art-pastel-shape {
          position: absolute;
          width: 240px; height: 300px;
          background: linear-gradient(135deg, rgba(153, 246, 228, 0.5), rgba(167, 243, 208, 0.3));
          transform: rotate(-8deg);
          border-radius: 36px;
          z-index: 0;
          bottom: 20px; right: 30px;
          filter: blur(12px);
        }
        .dl-art-green-shape {
          position: absolute;
          width: 200px; height: 200px;
          background: #99F6E4;
          border-radius: 50%;
          z-index: 0;
          top: 20px; left: 20px;
          opacity: 0.5;
          filter: blur(40px);
        }
        .dl-art-vertical-text {
          position: absolute;
          top: 50%; right: 12px;
          transform: translateY(-50%) rotate(90deg);
          transform-origin: center right;
          font-size: 10px; font-weight: 800;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #0D9488; opacity: 0.45;
          white-space: nowrap; z-index: 3;
        }

        /* BRAND SHOWCASE CARD (NO PHOTO) */
        .dl-brand-showcase-card {
          position: relative; z-index: 2;
          width: 100%; max-width: 360px;
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(16px);
          border: 1.5px solid rgba(13, 148, 136, 0.2);
          border-radius: 28px;
          padding: 44px 32px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          box-shadow: 0 24px 60px rgba(13, 148, 136, 0.12), 0 4px 16px rgba(0, 0, 0, 0.02);
          transition: all 0.3s ease;
        }
        .dl-brand-showcase-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 32px 70px rgba(13, 148, 136, 0.18);
        }
        .dl-showcase-logo {
          height: 84px; width: auto; object-fit: contain;
          margin-bottom: 20px; border-radius: 20px;
          filter: drop-shadow(0 12px 24px rgba(13, 148, 136, 0.22));
        }
        .dl-showcase-brandname {
          font-size: 26px; font-weight: 900; color: #0F172A; letter-spacing: -0.03em;
          margin-bottom: 6px;
        }
        .dl-showcase-brandname span { color: #0D9488; }
        .dl-showcase-sub {
          font-size: 13px; font-weight: 600; color: #64748B; margin-bottom: 24px;
        }
        .dl-showcase-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: #F0FDFA; border: 1px solid #CCFBF1;
          color: #0D9488; font-size: 12px; font-weight: 700;
          padding: 6px 16px; border-radius: 99px;
        }
        .dl-art-badge-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #10B981;
          box-shadow: 0 0 8px #10B981; flex-shrink: 0;
        }

        /* BOTTOM EDITORIAL FOOTER ROW */
        .dl-bottom-row {
          display: grid; grid-template-columns: repeat(3, 1fr);
          padding: 24px 48px;
          border-top: 1px solid rgba(13, 148, 136, 0.15);
          background: rgba(255, 255, 255, 0.55);
          backdrop-filter: blur(8px);
        }
        .dl-bottom-col {
          padding: 0 24px;
        }
        .dl-bottom-col:first-child { padding-left: 0; }
        .dl-bottom-col:last-child { padding-right: 0; }
        .dl-bottom-col + .dl-bottom-col {
          border-left: 1px solid rgba(13, 148, 136, 0.15);
        }
        .dl-bottom-label {
          font-size: 12px; font-weight: 800; color: #0F172A; margin-bottom: 4px;
          letter-spacing: -0.01em;
        }
        .dl-bottom-val {
          font-size: 13px; color: #64748B; font-weight: 600;
        }
        .dl-check-icon {
          width: 18px; height: 18px; border-radius: 50%;
          background: rgba(13,148,136,0.15); border: 1px solid rgba(13,148,136,0.3);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }

        /* ── SUPPORT / CTA SECTION ── */
        .cta-section {
          padding: 96px 48px;
          background: transparent;
          text-align: center;
        }
        .cta-box {
          max-width: 760px; margin: 0 auto;
          background: linear-gradient(135deg, #F0FDFA, #ECFDF5);
          border: 1px solid #CCFBF1; border-radius: 28px;
          padding: 64px 48px;
          position: relative;
        }
        .cta-title { font-size: clamp(28px,3.5vw,40px); font-weight: 800; color: #0F172A; letter-spacing: -0.025em; margin-bottom: 14px; }
        .cta-sub   { font-size: 15px; color: #64748B; line-height: 1.7; margin-bottom: 32px; max-width: 580px; margin-left: auto; margin-right: auto; }
        
        .support-details {
          margin-top: 36px; padding-top: 32px; border-top: 1px solid rgba(13,148,136,0.1);
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .support-mail-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #FFFFFF; border: 1.5px solid #CCFBF1;
          color: #0D9488; font-size: 14px; font-weight: 700;
          padding: 12px 24px; border-radius: 99px; text-decoration: none;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(13,148,136,0.04);
        }
        .support-mail-btn:hover {
          border-color: #0D9488; background: #F0FDFA; transform: translateY(-1px);
        }

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
          .nav-pricing-btn { display: none; }
          .nav-cta { display: none; }
          .features-grid { grid-template-columns: repeat(2,1fr); }
          .pricing-grid { grid-template-columns: 1fr; max-width: 480px; }
          .stats-grid { grid-template-columns: repeat(2,1fr); gap: 28px; }
          .stat-col + .stat-col { border-left: none; }
          .stat-col:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.1); }
          .dl-inner { grid-template-columns: 1fr; }
          .dl-left { padding: 40px 28px; }
          .dl-right-art { padding: 32px 24px; min-height: 320px; }
          .dl-bottom-row { grid-template-columns: 1fr; gap: 16px; padding: 24px; }
          .dl-bottom-col + .dl-bottom-col { border-left: none; border-top: 1px solid rgba(13, 148, 136, 0.15); padding-top: 16px; padding-left: 0; }
        }
        @media (max-width: 640px) {
          .lp-nav { padding: 0 20px; }
          .hero { padding: 120px 20px 0; }
          .hero-h1 { font-size: clamp(32px, 8vw, 48px); line-height: 1.1; }
          .hero-visual { margin: 36px 16px 0; }
          .hero-img-wrapper { border-radius: 18px; }
          .hero-img { height: 360px; }
          .hero-img-overlay { border-radius: 18px; }

          .features-section { padding: 64px 20px; }
          .features-grid { grid-template-columns: 1fr; }
          .pricing-section { padding: 64px 20px; }
          .download-section { padding: 64px 20px; }
          .dl-top-bar { padding: 24px 20px 0; }
          .dl-left { padding: 28px 20px; }
          .dl-right-art { padding: 24px 20px; }
          .dl-right { padding: 32px 24px; }
          .dl-sysreq-grid { grid-template-columns: 1fr; }
          .dl-platform-row { flex-direction: column; }
          .faq-section { padding: 64px 20px; }
          .faq-trigger { padding: 20px; font-size: 15px; }
          .stats-band { padding: 52px 20px; }
          .cta-section { padding: 64px 20px; }
          .cta-box { padding: 48px 24px; }
          .footer { padding: 36px 20px 24px; }
          .footer-inner { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-close" onClick={() => setMenuOpen(false)}>×</button>
          {(isElectron ? NAV_LINKS.filter(l => l !== 'Download') : NAV_LINKS).map(l => (
            <button key={l} className="mobile-menu-link" onClick={() => scrollTo(l)}>{l}</button>
          ))}
          <Link href="/login" className="btn-primary" style={{ padding: '14px 36px', fontSize: 16 }}>
            Get Started
          </Link>
        </div>
      )}

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <Link className="nav-brand" href="/">
          <img src="/logo.png" alt="ApexTrack" className="nav-brand-img" />
          <span className="nav-brand-name">Apex<span>Track</span></span>
        </Link>

        <div className="nav-links-center">
          {(isElectron ? NAV_LINKS.filter(l => l !== 'Download') : NAV_LINKS).map(l => (
            <button key={l} className="nav-link" onClick={() => scrollTo(l)}>
              {l} <span className="nav-link-arrow">▾</span>
            </button>
          ))}
        </div>

        <div className="nav-right">
          <button className="nav-pricing-btn" onClick={() => scrollTo('Pricing')}>Pricing</button>
          <Link href="/login" className="nav-cta">Get Started</Link>
          <button className="nav-hamburger" onClick={() => setMenuOpen(true)}>
            <IconMenu size={20} color="currentColor" />
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        {/* Eyebrow */}
        <div className="hero-eyebrow">
          <div className="hero-eyebrow-dot" />
          <span className="hero-eyebrow-text">Ghana's #1 Football Management Software</span>
        </div>

        {/* Headline */}
        <h1 className="hero-h1">
          Run Your Football<br />
          Club Smarter — From<br />
          Pitch to Payroll
        </h1>

        {/* Subtext */}
        <p className="hero-sub">
          Manage squad rosters, track match performance, log player injuries, and run club payroll in one unified platform built for football.
        </p>

        {/* CTA Buttons */}
        <div className="hero-btns">
          {!isElectron && (
            <a 
              href="#download"
              onClick={e => { e.preventDefault(); document.getElementById('download')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="btn-primary" 
              style={{ background: 'linear-gradient(135deg, #0F766E, #0D9488)', border: 'none', boxShadow: '0 8px 24px rgba(13, 148, 136, 0.25)', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download Windows App
            </a>
          )}
          <Link href="/login?tab=signup" className="btn-primary">
            Get Started — It&apos;s Free
          </Link>
          <Link href="/login" className="btn-outline">
            Sign In — Dashboard
          </Link>
        </div>

        {/* Hero visual */}
        <div className="hero-visual">
          <div className="hero-img-wrapper">
            <img src="/hero-football.png" alt="Football player in action" className="hero-img" />
            <div className="hero-img-overlay" />
            <div className="hero-img-accent" />
          </div>
        </div>
      </section>



      {/* ── FEATURES ── */}
      <section className="features-section" id="features">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="section-eyebrow">
            <div className="eyebrow-line" />
            <span className="eyebrow-text">Platform</span>
          </div>
          <h2 className="section-title">Everything your club needs</h2>
          <p className="section-sub">
            From grassroots academies to semi-professional clubs — ApexTrack covers every operation on and off the pitch.
          </p>
          <div className="features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feat-card">
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <div className="feat-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <div className="stats-band">
        <div className="stats-grid">
          {STATS.map(s => (
            <div key={s.label} className="stat-col">
              <div className="stat-val">{s.value}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PRICING SECTION ── */}
      <section className="pricing-section" id="pricing">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="section-eyebrow">
            <div className="eyebrow-line" />
            <span className="eyebrow-text">Pricing</span>
          </div>
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 8 }}>Simple, transparent plans</h2>
          <p className="section-sub" style={{ textAlign: 'center', margin: '0 auto 52px' }}>
            Choose the plan that fits your club. Upgrade anytime as you grow.
          </p>

          <div className="pricing-grid">
            {/* Starting XI Tier Card */}
            <div className="price-card">
              <div>
                <div className="price-tier">Starting XI</div>
                <p className="price-desc">For grassroots clubs, academies, and smaller setups looking to digitize their operations.</p>
                <div className="price-amount">GHS 199 <span>/ month</span></div>
                
                <ul className="price-features">
                  {[
                    'Up to 40 active athlete profiles',
                    'Squad Roster & Player Registry',
                    'Training Scheduler & Calendars',
                    'Full Injury Hub Lifecycle Tracking',
                    'Basic Performance Reports PDF Export',
                    'Admin + Coach + Physio roles',
                    'Standard Email Support',
                  ].map(feat => (
                    <li key={feat} className="price-feat-item">
                      <div className="price-feat-check"><IconCheck size={11} color="currentColor" /></div>
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* ApexPay NOT included notice */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#F8FAFC', border: '1px dashed #CBD5E1',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 24
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#94A3B8" strokeWidth="2"/>
                    <path d="M12 8v5M12 16h.01" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                    ApexPay (Payroll) not included — upgrade to Captain
                  </span>
                </div>
              </div>
              <Link href="/login?tab=signup" className="price-btn outline">
                Get Started
              </Link>
            </div>

            {/* Captain Tier Card */}
            <div className="price-card featured">
              <div className="price-badge">Most Popular</div>
              <div>
                <div className="price-tier">Captain</div>
                <p className="price-desc">For semi-pro and professional clubs serious about performance, analytics, and staff payroll.</p>
                <div className="price-amount">GHS 499 <span>/ month</span></div>
                
                <ul className="price-features">
                  {[
                    'Unlimited active athletes',
                    'Everything in Starting XI plan',
                    'Performance Analytics (xG, xA, match ratings)',
                    'Scouting Module & Transfer History',
                    'Advanced Reports (board-level summaries)',
                    'All 4 roles including Analyst',
                    'Custom club logo & branding',
                    'Priority support + guided onboarding',
                  ].map(feat => (
                    <li key={feat} className="price-feat-item">
                      <div className="price-feat-check"><IconCheck size={11} color="currentColor" /></div>
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* ApexPay included callout */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#F0FDFA', border: '1px solid #99F6E4',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 24
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="3" stroke="#0D9488" strokeWidth="2"/>
                    <path d="M2 10h20" stroke="#0D9488" strokeWidth="2"/>
                    <circle cx="7" cy="15" r="1.5" fill="#0D9488"/>
                    <path d="M12 14h5" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <span style={{ fontSize: 12, color: '#0D9488', fontWeight: 800 }}>ApexPay Included</span>
                    <span style={{ fontSize: 11, color: '#0F766E', marginLeft: 6, fontWeight: 500 }}>— Club payroll & MoMo disbursements</span>
                  </div>
                </div>
              </div>
              <Link href="/login?tab=signup" className="price-btn primary">
                Subscribe to Captain →
              </Link>
            </div>
          </div>

          {/* ApexPay explainer strip */}
          <div style={{
            marginTop: 32,
            background: 'linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)',
            border: '1px solid #99F6E4',
            borderRadius: 18,
            padding: '24px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="5" width="20" height="14" rx="3" stroke="#fff" strokeWidth="2"/>
                  <path d="M2 10h20" stroke="#fff" strokeWidth="2"/>
                  <circle cx="7" cy="15" r="1.5" fill="#fff"/>
                  <path d="M12 14h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>What is ApexPay?</div>
                <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Included in Captain Plan</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, margin: 0 }}>
                <strong style={{ color: '#0F172A' }}>ApexPay</strong> is our built-in club payroll system. Fund your club wallet via Mobile Money, run payroll cycles for players and staff, and track every disbursement — all inside ApexTrack. No third-party apps, no spreadsheets.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DOWNLOAD SECTION (EDITORIAL ART STYLE) ── */}
      {!isElectron && (
        <section className="download-section" id="download">
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div className="section-eyebrow">
              <div className="eyebrow-line" />
              <span className="eyebrow-text">Desktop App</span>
            </div>
            <h2 className="section-title">Download ApexTrack</h2>
            <p className="section-sub">The full platform, installed natively on your computer. Works offline for core features, syncs automatically when online.</p>
          </div>

          <div style={{ maxWidth: 1100, margin: '32px auto 0' }}>
            <div className="dl-hero-card">
              
              {/* TOP BRAND & STATUS STRIP (Editorial Style) */}
              <div className="dl-top-bar">
                <div className="dl-top-brand">
                  <img src="/logo.png" alt="ApexTrack" style={{ height: 24, width: 'auto', borderRadius: 4 }} />
                  ApexTrack <span>Desktop</span>
                </div>
                <div className="dl-top-badge">
                  v1.0.5 · Latest Release
                </div>
              </div>

              <div className="dl-inner">
                {/* LEFT EDITORIAL COLUMN */}
                <div className="dl-left">
                  <div className="dl-greeting">
                    <div className="dl-greeting-dot" />
                    Hi There,
                  </div>

                  <h3 className="dl-headline-editorial">
                    I am Apex<span className="highlight-dot">Track</span>
                  </h3>
                  
                  <p className="dl-sub-editorial">
                    I am squad manager during matchday &amp; work with football clubs 24/7 with native speed and offline power.
                  </p>

                  <div className="dl-cta-row">
                    <a
                      href="https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack-Setup.exe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dl-btn-primary"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12M8 12l4 4 4-4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Download for Windows
                    </a>
                  </div>

                  <div className="dl-platforms-minimal">
                    <div className="dl-platform-pill active">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="2" width="9" height="9" rx="1" fill="#0D9488"/>
                        <rect x="13" y="2" width="9" height="9" rx="1" fill="#0D9488"/>
                        <rect x="2" y="13" width="9" height="9" rx="1" fill="#0D9488"/>
                        <rect x="13" y="13" width="9" height="9" rx="1" fill="#0D9488"/>
                      </svg>
                      Windows (Active)
                    </div>
                    <div className="dl-platform-pill disabled">
                      macOS (Soon)
                    </div>
                    <div className="dl-platform-pill disabled">
                      Linux (Soon)
                    </div>
                  </div>
                </div>

                {/* RIGHT EDITORIAL ARTWORK COLUMN (Image 1 Style) */}
                <div className="dl-right-art">
                  {/* Decorative Elements */}
                  <div className="dl-art-green-shape" />
                  <div className="dl-art-pastel-shape" />
                  <img src="/logo.png" alt="ApexTrack Logo" className="dl-art-giant-logo" />
                  
                  {/* Vertical Rotated Text (matching Image 1) */}
                  <div className="dl-art-vertical-text">
                    NATIVE DESKTOP • OFFLINE POWERED • ZERO LATENCY
                  </div>

                  {/* Brand Showcase Emblem Card (No Photo) */}
                  <div className="dl-brand-showcase-card">
                    <img src="/logo.png" alt="ApexTrack Logo" className="dl-showcase-logo" />
                    <div className="dl-showcase-brandname">Apex<span>Track</span></div>
                    <div className="dl-showcase-sub">Windows Desktop Application</div>
                    
                    <div className="dl-showcase-badge">
                      <div className="dl-art-badge-dot" />
                      <span>v1.0.5 · Official Release</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTTOM EDITORIAL INFO BAR (Matching Image 1's Email / Phone / Location bar) */}
              <div className="dl-bottom-row">
                <div className="dl-bottom-col">
                  <div className="dl-bottom-label">Installer Package</div>
                  <div className="dl-bottom-val">ApexTrack-Setup.exe (~145 MB)</div>
                </div>
                <div className="dl-bottom-col">
                  <div className="dl-bottom-label">System Requirement</div>
                  <div className="dl-bottom-val">Windows 10 / 11 (64-bit Edition)</div>
                </div>
                <div className="dl-bottom-col">
                  <div className="dl-bottom-label">Security &amp; Support</div>
                  <div className="dl-bottom-val">Signed &amp; Verified · admin@apextrackgh.com</div>
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ── FAQ SECTION ── */}
      <section className="faq-section" id="faq">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="section-eyebrow">
            <div className="eyebrow-line" />
            <span className="eyebrow-text">FAQ</span>
          </div>
          <h2 className="section-title" style={{ textAlign: 'center', marginBottom: 12 }}>Frequently Asked Questions</h2>
          <p className="section-sub" style={{ textAlign: 'center', margin: '0 auto 52px' }}>
            Everything you need to know about the platform, security, and onboarding.
          </p>

          <div className="faq-list">
            {FAQS.map((faq, idx) => (
              <div 
                key={idx} 
                className={`faq-item${activeFaq === idx ? ' active' : ''}`}
              >
                <button 
                  className="faq-trigger" 
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                >
                  <span>{faq.q}</span>
                  <span className="faq-icon">▼</span>
                </button>
                <div className="faq-content">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SUPPORT / CTA SECTION ── */}
      <section className="cta-section" id="support">
        <div className="cta-box">
          <h2 className="cta-title">Ready to run your club smarter?</h2>
          <p className="cta-sub">
            Join 60+ football clubs and academies across Africa already managing squads, tracking performance, and running payroll with ApexTrack.
            Get started today — no credit card required.
          </p>
          <div className="cta-btns">
            <Link href="/login?tab=signup" className="btn-primary">Get Started Free →</Link>
            <Link href="/login" className="btn-outline">Sign In</Link>
          </div>

          <div className="support-details">
            <p style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Need help with setup or data migration?</p>
            <a href="mailto:admin@apextrackgh.com" className="support-mail-btn">
              admin@apextrackgh.com
            </a>
            <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Onboarding, roster imports, and technical setup are provided free of charge for all plans.</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">Apex<span>Track</span></div>
          <div className="footer-links">
            {!isElectron && (
              <a href="https://github.com/crow1126/athletehub/releases/download/v1.0.5/ApexTrack-Setup.exe" target="_blank" rel="noopener noreferrer" className="footer-link">Download Windows App (.exe)</a>
            )}
            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
            <Link href="/terms" className="footer-link">Terms of Service</Link>
            <Link href="/security" className="footer-link">Security</Link>
            <Link href="/login" className="footer-link">Sign In</Link>
          </div>
        </div>
        <div className="footer-copy">© {new Date().getFullYear()} ApexTrack. All rights reserved. Football Club Management Platform built for African football clubs.</div>
      </footer>
    </>
  )
}
