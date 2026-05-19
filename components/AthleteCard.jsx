'use client'
import { useState } from 'react'
import Link from 'next/link'

const AV_COLORS = ['#006A6A', '#008080', '#2D6B6B', '#553C9A', '#1B7A3E', '#2B6CB0']

function initials(n) {
  return (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Green football-pitch banner ─────────────────────────────────────────────
function BannerSVG() {
  return (
    <svg
      viewBox="0 0 280 110"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* Base green */}
      <rect width="280" height="110" fill="#0F6E56" />
      {/* Darker green stripes (pitch look) */}
      {[0,1,2,3,4,5,6].map(i => (
        <rect key={i} x={i*40} y="0" width="20" height="110" fill="#0d6350" opacity="0.5" />
      ))}
      {/* Pitch markings */}
      <rect x="40"  y="10" width="200" height="90" rx="2" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <line x1="140" y1="10" x2="140" y2="100" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <circle cx="140" cy="55" r="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <circle cx="140" cy="55" r="3"  fill="rgba(255,255,255,0.3)" />
      {/* penalty boxes */}
      <rect x="40"  y="30" width="52" height="50" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <rect x="188" y="30" width="52" height="50" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      {/* gradient overlay so text is readable */}
      <defs>
        <linearGradient id="bfade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F6E56" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#064535" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect width="280" height="110" fill="url(#bfade)" />
    </svg>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function AthleteAvatar({ athlete, size = 56, index = 0 }) {
  const [err, setErr] = useState(false)
  const bg = AV_COLORS[index % AV_COLORS.length]
  if (athlete?.photo_url && !err) {
    return (
      <img
        src={athlete.photo_url}
        alt={athlete.name || ''}
        onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color: '#fff', letterSpacing: '0.02em',
    }}>
      {initials(athlete?.name)}
    </div>
  )
}

// ─── Small info row item ──────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  if (!value) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 0',
      borderBottom: '0.5px solid #F0F4F4',
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(0,106,106,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 11, color: '#5A8A8A', fontWeight: 500, minWidth: 72 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#0D2B2B', fontWeight: 700, marginLeft: 'auto', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
/**
 * AthleteCard
 *
 * Props:
 *   athlete   — row from `athletes` table (with optional `coaches(name)` join)
 *   index     — avatar colour index (position in list)
 *   href      — wraps name in a Link to the athlete profile
 *   onConnect — callback for Connect button
 *   onContact — callback for Get in Touch button
 */
export default function AthleteCard({
  athlete = {},
  index   = 0,
  href,
  onConnect,
  onContact,
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [hovered,    setHovered]    = useState(false)

  const statusColors = {
    Active:    { bg: '#E1F5EE', color: '#085041' },
    Injured:   { bg: '#FAECE7', color: '#712B13' },
    Suspended: { bg: '#FAEEDA', color: '#633806' },
  }
  const sc = statusColors[athlete.status] || statusColors.Active

  // Format foot display
  const footMap = { right: 'Right', left: 'Left', both: 'Both' }
  const foot = footMap[athlete.strong_foot] || athlete.strong_foot

  const nameEl = (
    <span style={{
      fontSize: 14, fontWeight: 700, color: '#0D2B2B',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {athlete.name || 'Unknown Athlete'}
    </span>
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        border: `0.5px solid ${hovered ? 'rgba(0,106,106,0.3)' : '#E0EEEA'}`,
        boxShadow: hovered
          ? '0 8px 28px rgba(0,106,106,0.13), 0 2px 8px rgba(0,0,0,0.06)'
          : '0 2px 10px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >

      {/* ── Green banner ── */}
      <div style={{ height: 100, position: 'relative', overflow: 'hidden' }}>
        <BannerSVG />
      </div>

      {/* ── Identity row ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 10,
        padding: '0 14px', marginTop: -28, position: 'relative',
      }}>
        {/* Avatar ring */}
        <div style={{
          borderRadius: '50%',
          border: '3px solid #fff',
          flexShrink: 0,
          lineHeight: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}>
          <AthleteAvatar athlete={athlete} size={56} index={index} />
        </div>

        {/* Name + location */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            {href
              ? <Link href={href} style={{ textDecoration: 'none' }}>{nameEl}</Link>
              : nameEl
            }
            {/* verified tick */}
            <span style={{
              width: 14, height: 14, borderRadius: '50%', background: '#1D9E75',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg viewBox="0 0 10 10" width="9" height="9" fill="none">
                <polyline points="2,5 4.2,7.5 8,3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#5A8A8A', display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            {athlete.region || 'Ghana'}
          </div>
        </div>

        {/* Bookmark + link icons */}
        <div style={{ display: 'flex', gap: 6, paddingTop: 30 }}>
          <button
            onClick={() => setBookmarked(b => !b)}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: bookmarked ? '#E1F5EE' : '#F4F7F7',
              border: `0.5px solid ${bookmarked ? 'rgba(0,106,106,0.25)' : '#E0EEEA'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: bookmarked ? '#006A6A' : '#5A8A8A',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(href ? window.location.origin + href : window.location.href)}
            aria-label="Copy link"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#F4F7F7', border: '0.5px solid #E0EEEA',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#5A8A8A',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Position + Status pills ── */}
      <div style={{ padding: '7px 14px 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {athlete.position && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
            background: '#E6F1FB', color: '#0C447C',
          }}>
            {athlete.position}
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
          background: sc.bg, color: sc.color,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color }} />
          {athlete.status || 'Active'}
        </span>
        {athlete.club && (
          <span style={{ fontSize: 10, color: '#5A8A8A', fontWeight: 500, marginLeft: 'auto', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {athlete.club}
          </span>
        )}
      </div>

      {/* ── Profile info rows ── */}
      <div style={{ padding: '10px 14px 4px' }}>

        <InfoRow
          label="Age"
          value={athlete.age ? `${athlete.age} yrs` : null}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          }
        />

        <InfoRow
          label="Strong Foot"
          value={foot || null}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
          }
        />

        <InfoRow
          label="Height"
          value={athlete.height ? `${athlete.height} cm` : null}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="22"/><polyline points="17,7 12,2 7,7"/><polyline points="7,17 12,22 17,17"/>
            </svg>
          }
        />

        <InfoRow
          label="Weight"
          value={athlete.weight ? `${athlete.weight} kg` : null}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="6" r="3"/><path d="M6.2 17a6 6 0 0111.6 0"/>
              <rect x="2" y="17" width="20" height="4" rx="1"/>
            </svg>
          }
        />

        <InfoRow
          label="Phone"
          value={athlete.phone || null}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.06 2.18 2 2 0 012.03 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          }
        />

        {/* Coach row — if available */}
        <InfoRow
          label="Coach"
          value={athlete.coaches?.name?.replace('Coach ', '') || null}
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2D6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          }
        />

      </div>

      {/* ── Divider ── */}
      <div style={{ height: '0.5px', background: '#E0EEEA', margin: '6px 14px 0' }} />

      {/* ── Action buttons ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 14px 14px' }}>
        <button
          onClick={onConnect}
          onMouseEnter={e => e.currentTarget.style.background = '#F0FAF9'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          style={{
            height: 38, borderRadius: 19,
            border: '0.5px solid #B8D8D4', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, color: '#0D2B2B',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Connect
        </button>

        <button
          onClick={onContact}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          style={{
            height: 38, borderRadius: 19, border: 'none', background: '#1D9E75',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 12, fontWeight: 700, color: '#04342C',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
          </svg>
          Get in Touch
        </button>
      </div>

    </div>
  )
}