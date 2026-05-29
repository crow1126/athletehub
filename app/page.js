'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const NAV_LINKS = ['Features', 'Pricing', 'FAQ', 'Support']

const FEATURES = [
  { emoji: '📊', title: 'Performance Analytics', desc: 'xG, xA, match ratings, and squad-level trend views with beautiful premium charts.' },
  { emoji: '🏥', title: 'Injury Hub', desc: 'Full injury lifecycle — onset, treatment, recovery timeline, and return-to-play clearance.' },
  { emoji: '👥', title: 'Squad Management', desc: 'Complete athlete registry with positions, physical data, and coach assignments.' },
  { emoji: '📅', title: 'Training Scheduler', desc: 'Session planner with type categorisation, venue booking, and duration tracking.' },
  { emoji: '🔍', title: 'Scouting Module', desc: 'Prospect tracking, trial management, and comparison tools for transfers.' },
  { emoji: '📄', title: 'Reports', desc: 'Automated performance and medical reports for board and technical staff.' },
  { 
    emoji: '💬', 
    title: 'Dedicated Support', 
    desc: (
      <span>
        Direct technical assistance and custom onboarding support via active email{' '}
        <a href="mailto:admin@apextrackgh.com" className="feat-link">
          admin@apextrackgh.com
        </a>.
      </span>
    )
  },
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

const FAQS = [
  {
    q: 'How secure is our club and athlete database?',
    a: 'ApexTrack utilizes Postgres Row Level Security (RLS) and TLS encryption to isolate your squad data completely. Only coaches and administrators in your specific club are granted permission to access your athlete and injury records.'
  },
  {
    q: 'Is there a limit on how many athletes or coaches we can add?',
    a: 'No! During our current beta period, clubs can onboard unlimited squads, athletes, trainers, and coaches to fully experience all the features of ApexTrack.'
  },
  {
    q: 'How do we request custom feature additions or onboarding support?',
    a: 'We provide full custom setup and data import support. Just drop us an email at admin@apextrackgh.com and our engineering team will assist your club for free.'
  },
  {
    q: 'Can we export reports for club executives or board members?',
    a: 'Yes, ApexTrack enables you to generate comprehensive PDF performance sheets, medical summaries, and transfer history reports in just a few clicks.'
  }
]

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFaq, setActiveFaq] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll)
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
          background-color: #080f12;
          background-image: 
            linear-gradient(125deg, rgba(220, 238, 230, 0.12) 20%, rgba(220, 238, 230, 0.04) 30%, transparent 45%),
            linear-gradient(115deg, transparent 35%, rgba(220, 238, 230, 0.08) 45%, rgba(220, 238, 230, 0.02) 55%, transparent 70%),
            radial-gradient(circle at 10% 20%, rgba(13, 148, 136, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 90% 10%, rgba(20, 184, 166, 0.12) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(13, 148, 136, 0.08) 0%, transparent 50%),
            linear-gradient(135deg, #0f1c22 0%, #070e11 50%, #0b171a 100%);
          background-attachment: fixed;
          color: #F8FAFC;
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
          background: rgba(8, 15, 18, 0.75);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          transition: box-shadow 0.3s, height 0.3s;
        }
        .lp-nav.scrolled {
          box-shadow: 0 1px 0 rgba(255,255,255,0.07), 0 4px 20px rgba(0,0,0,0.25);
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
          font-size: 18px; font-weight: 800; color: #FFFFFF;
          letter-spacing: -0.03em;
        }
        .nav-brand-name span { color: #2DD4BF; }

        .nav-links-center {
          display: flex; align-items: center; gap: 36px;
          position: absolute; left: 50%; transform: translateX(-50%);
        }
        .nav-link {
          font-size: 14px; font-weight: 600; color: #94A3B8;
          text-decoration: none; background: none; border: none;
          cursor: pointer; font-family: inherit;
          transition: color 0.2s;
          display: flex; align-items: center; gap: 4px;
        }
        .nav-link:hover { color: #FFFFFF; }
        .nav-link-arrow { font-size: 10px; opacity: 0.5; }

        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-pricing-btn {
          font-size: 14px; font-weight: 600; color: #94A3B8;
          background: none; border: none; cursor: pointer;
          font-family: inherit; transition: color 0.2s;
          text-decoration: none;
        }
        .nav-pricing-btn:hover { color: #FFFFFF; }
        .nav-cta {
          background: #FFFFFF; color: #080f12;
          border: none; border-radius: 99px;
          padding: 10px 22px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.2s; text-decoration: none;
          display: inline-flex; align-items: center;
        }
        .nav-cta:hover { background: #E2E8F0; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,255,255,0.1); }
        .nav-hamburger {
          display: none; background: none; border: none;
          cursor: pointer; color: #FFFFFF; font-size: 22px; padding: 4px;
        }

        /* ── MOBILE MENU ── */
        .mobile-menu {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(8, 15, 18, 0.98); backdrop-filter: blur(16px);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 32px;
          animation: fadeIn 0.2s ease;
        }
        .mobile-menu-close {
          position: absolute; top: 20px; right: 20px;
          background: none; border: none; font-size: 28px;
          cursor: pointer; color: #FFFFFF;
        }
        .mobile-menu-link {
          font-size: 24px; font-weight: 700; color: #FFFFFF;
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
          background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(20, 184, 166, 0.25);
          border-radius: 99px; padding: 5px 14px 5px 8px;
          margin-bottom: 28px;
          opacity: 0; animation: fadeUp 0.6s ease 0.2s forwards;
        }
        .hero-eyebrow-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #2DD4BF; animation: float0 2s ease-in-out infinite;
        }
        .hero-eyebrow-text {
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #2DD4BF;
        }
        .hero-h1 {
          font-size: clamp(44px, 7vw, 88px);
          font-weight: 800; line-height: 1.04;
          letter-spacing: -0.03em; color: #FFFFFF;
          margin-bottom: 22px; max-width: 760px; margin-left: auto; margin-right: auto;
          opacity: 0; animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.3s forwards;
        }
        .hero-sub {
          font-size: clamp(15px, 1.8vw, 18px); line-height: 1.65;
          color: #94A3B8; max-width: 540px; margin: 0 auto 36px;
          font-weight: 500;
          opacity: 0; animation: fadeUp 0.8s ease 0.45s forwards;
        }
        .hero-btns {
          display: flex; align-items: center; justify-content: center;
          gap: 12px; flex-wrap: wrap;
          opacity: 0; animation: fadeUp 0.7s ease 0.6s forwards;
        }
        .btn-primary {
          background: #0D9488; color: #fff;
          border: none; border-radius: 99px;
          padding: 15px 32px; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.22s;
          box-shadow: 0 8px 24px rgba(13, 148, 136, 0.25);
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(20, 184, 166, 0.35); background: #14B8A6; }
        .btn-outline {
          background: transparent; color: #FFFFFF;
          border: 1.5px solid rgba(255, 255, 255, 0.2); border-radius: 99px;
          padding: 15px 32px; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.22s;
          text-decoration: none; display: inline-flex; align-items: center;
        }
        .btn-outline:hover { border-color: rgba(255, 255, 255, 0.45); background: rgba(255, 255, 255, 0.06); transform: translateY(-2px); }

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
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border-radius: 14px; padding: 11px 15px;
          display: flex; align-items: center; gap: 10px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          white-space: nowrap;
        }
        .hf-icon {
          width: 34px; height: 34px; border-radius: 9px;
          background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(20, 184, 166, 0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0; color: #2DD4BF;
        }
        .hf-label { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748B; }
        .hf-val   { font-size: 16px; font-weight: 800; color: #FFFFFF; line-height: 1; }
        .hf-badge {
          display: inline-flex; align-items: center; gap: 4px;
          background: rgba(22, 163, 74, 0.15); border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 99px; padding: 3px 9px;
          font-size: 10px; font-weight: 700; color: #4ADE80;
        }

        /* ── FEATURES ── */
        .features-section {
          padding: 96px 48px;
          background: transparent;
        }
        .section-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          margin-bottom: 14px;
        }
        .eyebrow-line { width: 22px; height: 2px; background: linear-gradient(90deg,#2DD4BF,#0D9488); border-radius: 2px; }
        .eyebrow-text { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #2DD4BF; }
        .section-title {
          font-size: clamp(28px, 3.5vw, 42px); font-weight: 800;
          color: #FFFFFF; letter-spacing: -0.025em; margin-bottom: 12px;
        }
        .section-sub {
          font-size: 15px; color: #94A3B8; line-height: 1.75;
          max-width: 480px; margin-bottom: 52px;
        }
        .features-grid {
          max-width: 1100px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .feat-card {
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          border-radius: 18px; padding: 28px 24px;
          transition: all 0.22s ease;
        }
        .feat-card:hover {
          border-color: rgba(45, 212, 191, 0.35);
          box-shadow: 0 8px 32px rgba(13,148,136,0.12);
          transform: translateY(-3px);
        }
        .feat-icon {
          width: 46px; height: 46px; border-radius: 13px;
          background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(20, 184, 166, 0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 18px;
        }
        .feat-title { font-size: 15px; font-weight: 700; color: #FFFFFF; margin-bottom: 8px; }
        .feat-desc  { font-size: 13px; color: #94A3B8; line-height: 1.7; }
        .feat-link { color: #2DD4BF; text-decoration: underline; font-weight: 600; }
        .feat-link:hover { color: #2DD4BF; text-shadow: 0 0 10px rgba(45, 212, 191, 0.4); }

        /* ── STATS BAND ── */
        .stats-band {
          background: rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(8px);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 64px 48px;
        }
        .stats-grid {
          max-width: 960px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4,1fr); gap: 0;
          text-align: center;
        }
        .stat-col { padding: 0 24px; }
        .stat-col + .stat-col { border-left: 1px solid rgba(255,255,255,0.07); }
        .stat-val { font-size: clamp(36px,4vw,56px); font-weight: 900; color: #fff; letter-spacing: -0.03em; line-height: 1; margin-bottom: 8px; }
        .stat-lbl { font-size: 12px; font-weight: 600; color: #94A3B8; letter-spacing: 0.05em; text-transform: uppercase; }

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
          background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(8px);
          border-radius: 24px; padding: 40px;
          display: flex; flex-direction: column; justify-content: space-between;
          position: relative; transition: all 0.25s ease;
        }
        .price-card.featured {
          border-color: rgba(45, 212, 191, 0.4);
          background: rgba(13, 148, 136, 0.06);
          box-shadow: 0 12px 40px rgba(13, 148, 136, 0.1);
        }
        .price-badge {
          position: absolute; top: 20px; right: 20px;
          background: rgba(20, 184, 166, 0.15); border: 1px solid rgba(45, 212, 191, 0.25);
          color: #2DD4BF; font-size: 11px; font-weight: 700;
          padding: 4px 12px; border-radius: 99px; text-transform: uppercase;
        }
        .price-tier { font-size: 18px; font-weight: 800; color: #FFFFFF; margin-bottom: 8px; }
        .price-desc { font-size: 13px; color: #94A3B8; line-height: 1.5; margin-bottom: 24px; }
        .price-amount { font-size: 40px; font-weight: 900; color: #FFFFFF; display: flex; align-items: baseline; gap: 4px; margin-bottom: 28px; }
        .price-amount span { font-size: 14px; font-weight: 600; color: #64748B; }
        .price-features { list-style: none; display: flex; flex-direction: column; gap: 14px; margin-bottom: 36px; }
        .price-feat-item { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #CBD5E1; font-weight: 500; }
        .price-feat-check { width: 18px; height: 18px; border-radius: 50%; background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(20, 184, 166, 0.25); display: flex; align-items: center; justify-content: center; font-size: 10px; color: #2DD4BF; flex-shrink: 0; }
        
        .price-btn {
          width: 100%; text-align: center; padding: 14px;
          border-radius: 12px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.2s;
          text-decoration: none; display: block; box-sizing: border-box;
        }
        .price-btn.primary { background: #0D9488; color: #FFFFFF; border: none; box-shadow: 0 4px 14px rgba(13,148,136,0.25); }
        .price-btn.primary:hover { background: #14B8A6; transform: translateY(-1px); }
        .price-btn.outline { background: transparent; color: #FFFFFF; border: 1.5px solid rgba(255, 255, 255, 0.15); }
        .price-btn.outline:hover { border-color: rgba(255, 255, 255, 0.4); background: rgba(255, 255, 255, 0.06); transform: translateY(-1px); }

        /* ── FAQ SECTION ── */
        .faq-section {
          padding: 96px 48px;
          background: transparent;
        }
        .faq-list { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .faq-item { background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; overflow: hidden; transition: all 0.2s ease; }
        .faq-item:hover { border-color: rgba(255, 255, 255, 0.15); }
        .faq-trigger {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 24px; background: none; border: none; text-align: left;
          font-size: 16px; font-weight: 700; color: #FFFFFF; cursor: pointer;
          font-family: inherit; transition: color 0.15s;
        }
        .faq-trigger:hover { color: #2DD4BF; }
        .faq-icon { font-size: 14px; color: #64748B; transition: transform 0.2s ease; }
        .faq-item.active .faq-icon { transform: rotate(180deg); color: #2DD4BF; }
        .faq-content { padding: 0 24px 24px; font-size: 14px; color: #94A3B8; line-height: 1.65; display: none; }
        .faq-item.active .faq-content { display: block; animation: fadeIn 0.3s ease; }

        /* ── SUPPORT / CTA SECTION ── */
        .cta-section {
          padding: 96px 48px;
          background: transparent;
          text-align: center;
        }
        .cta-box {
          max-width: 760px; margin: 0 auto;
          background: linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(6, 95, 70, 0.05) 100%);
          border: 1px solid rgba(20, 184, 166, 0.15); border-radius: 28px;
          padding: 64px 48px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        }
        .cta-title { font-size: clamp(28px,3.5vw,40px); font-weight: 800; color: #FFFFFF; letter-spacing: -0.025em; margin-bottom: 14px; }
        .cta-sub   { font-size: 15px; color: #94A3B8; line-height: 1.7; margin-bottom: 32px; max-width: 580px; margin-left: auto; margin-right: auto; }
        
        .support-details {
          margin-top: 36px; padding-top: 32px; border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .support-mail-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255, 255, 255, 0.03); border: 1.5px solid rgba(20, 184, 166, 0.2);
          color: #2DD4BF; font-size: 14px; font-weight: 700;
          padding: 12px 24px; border-radius: 99px; text-decoration: none;
          transition: all 0.2s; box-shadow: 0 4px 12px rgba(13,148,136,0.04);
        }
        .support-mail-btn:hover {
          border-color: #2DD4BF; background: rgba(13, 148, 136, 0.15); transform: translateY(-1px);
        }

        /* ── FOOTER ── */
        .footer {
          background: rgba(0, 0, 0, 0.3); padding: 48px 48px 32px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .footer-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 20px;
          padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .footer-brand { font-size: 17px; font-weight: 800; color: #fff; letter-spacing: -0.025em; }
        .footer-brand span { color: #2DD4BF; }
        .footer-links { display: flex; gap: 24px; flex-wrap: wrap; }
        .footer-link { font-size: 13px; color: rgba(255,255,255,0.4); text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .footer-link:hover { color: rgba(255,255,255,0.8); }
        .footer-copy { text-align: center; font-size: 12px; color: rgba(255,255,255,0.2); margin-top: 20px; max-width: 1100px; margin-left: auto; margin-right: auto; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .nav-links-center { display: none; }
          .nav-hamburger { display: block; }
          .features-grid { grid-template-columns: repeat(2,1fr); }
          .pricing-grid { grid-template-columns: 1fr; max-width: 480px; }
          .stats-grid { grid-template-columns: repeat(2,1fr); gap: 28px; }
          .stat-col + .stat-col { border-left: none; }
          .stat-col:nth-child(odd) { border-right: 1px solid rgba(255,255,255,0.07); }
        }
        @media (max-width: 640px) {
          .lp-nav { padding: 0 20px; }
          .hero { padding: 120px 20px 0; }
          .hero-visual { margin: 36px 16px 0; border-radius: 16px 16px 0 0; }
          .hero-img { border-radius: 16px 16px 0 0; }
          .hf-card { display: none; }
          .features-section { padding: 64px 20px; }
          .features-grid { grid-template-columns: 1fr; }
          .pricing-section { padding: 64px 20px; }
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
          {NAV_LINKS.map(l => (
            <button key={l} className="mobile-menu-link" onClick={() => scrollTo(l)}>{l}</button>
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
            <button key={l} className="nav-link" onClick={() => scrollTo(l)}>
              {l} <span className="nav-link-arrow">▾</span>
            </button>
          ))}
        </div>

        <div className="nav-right">
          <button className="nav-pricing-btn" onClick={() => scrollTo('Pricing')}>Pricing</button>
          <Link href="/login" className="nav-cta">Get Started</Link>
          <button className="nav-hamburger" onClick={() => setMenuOpen(true)}>☰</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
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



      {/* ── FEATURES ── */}
      <section className="features-section" id="features">
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
            Bring your club onboard today. Get complete access to all tracking metrics during our beta phase.
          </p>

          <div className="pricing-grid">
            {/* Free Tier Card */}
            <div className="price-card featured">
              <div className="price-badge">Active Beta</div>
              <div>
                <div className="price-tier">Standard Club</div>
                <p className="price-desc">Complete athlete registry, injury hub lifecycle, and training sessions scheduler.</p>
                <div className="price-amount">$0 <span>/ month during Beta</span></div>
                
                <ul className="price-features">
                  {[
                    'Unlimited active athletes tracking',
                    'Injury onset & recovery lifecycle tracking',
                    'Coaches & trainers dashboard',
                    'Basic performance reports PDF export',
                    'Postgres Row Level Security data isolation',
                    'Direct technical support via email',
                  ].map(feat => (
                    <li key={feat} className="price-feat-item">
                      <div className="price-feat-check">✓</div>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/login?tab=signup" className="price-btn primary">
                Register Free Beta Account →
              </Link>
            </div>

            {/* Pro Tier Card */}
            <div className="price-card">
              <div>
                <div className="price-tier">Pro Academy / Club</div>
                <p className="price-desc">Advanced performance analytics, full scouting logs, and tailored brand visuals.</p>
                <div className="price-amount">Contact Us <span>/ for custom pricing</span></div>
                
                <ul className="price-features">
                  {[
                    'Everything in Standard Beta plan',
                    'Expected goals (xG) & assists (xA) models',
                    'Scouting shortlist & trials management log',
                    'Custom club logo upload & theme visuals',
                    'Automated executive board reports builder',
                    'Priority Technical Account Onboarding',
                  ].map(feat => (
                    <li key={feat} className="price-feat-item">
                      <div className="price-feat-check">✓</div>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
              <a href="mailto:admin@apextrackgh.com?subject=ApexTrack%20Pro%20Custom%20Pricing" className="price-btn outline">
                Contact Technical Team
              </a>
            </div>
          </div>
        </div>
      </section>

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
          <h2 className="cta-title">Ready to elevate your squad?</h2>
          <p className="cta-sub">
            Join 40+ football clubs and academies already managing athletes smarter with ApexTrack.
            Start your free trial today — no credit card required.
          </p>
          <div className="cta-btns">
            <Link href="/login?tab=signup" className="btn-primary">Start Free Trial →</Link>
            <Link href="/login" className="btn-outline">Sign In</Link>
          </div>

          <div className="support-details">
            <p style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Need help setting up your team roster?</p>
            <a href="mailto:admin@apextrackgh.com" className="support-mail-btn">
              ✉ Email: admin@apextrackgh.com
            </a>
            <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Technical onboarding and roster imports are provided completely free of charge.</p>
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
        <div className="footer-copy">© {new Date().getFullYear()} ApexTrack. All rights reserved. Built for African football.</div>
      </footer>
    </>
  )
}
