'use client'
import { useState } from 'react'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────
const AV_COLORS = ['#006A6A', '#008080', '#2D6B6B', '#553C9A', '#1B7A3E', '#2B6CB0']

function initials(n) {
  return (n || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BannerSVG() {
  return (
    <svg
      viewBox="0 0 280 110"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <rect width="280" height="110" fill="#071020" />
      <ellipse cx="200" cy="20" rx="120" ry="90" fill="#0d2040" opacity="0.9" />
      <ellipse cx="60"  cy="90" rx="100" ry="60" fill="#0a1830" opacity="0.8" />
      <circle cx="240" cy="80" r="55" fill="#122a4a" opacity="0.5" />
      <circle cx="30"  cy="20" r="40" fill="#0e2236" opacity="0.6" />
      {/* pitch lines */}
      <line x1="0"   y1="55" x2="280" y2="55" stroke="#1a3a60" strokeWidth="0.5" opacity="0.4" />
      <line x1="140" y1="0"  x2="140" y2="110" stroke="#1a3a60" strokeWidth="0.5" opacity="0.3" />
      <circle cx="140" cy="55" r="30" fill="none" stroke="#1a3a60" strokeWidth="0.5" opacity="0.4" />
      <circle cx="140" cy="55" r="4"  fill="#1a3a60" opacity="0.5" />
    </svg>
  )
}

function AthleteAvatar({ athlete, size = 52, index = 0 }) {
  const [err, setErr] = useState(false)
  const bg = AV_COLORS[index % AV_COLORS.length]

  if (athlete?.photo_url && !err) {
    return (
      <img
        src={athlete.photo_url}
        alt={athlete.name || ''}
        onError={() => setErr(true)}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 800, color: '#fff',
      flexShrink: 0,
      letterSpacing: '0.02em',
    }}>
      {initials(athlete?.name)}
    </div>
  )
}

function VerifiedBadge({ color = '#1D9E75', checkColor = '#04342C' }) {
  return (
    <span
      aria-label="Verified"
      style={{
        width: 14, height: 14,
        borderRadius: '50%',
        background: color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 10 10" width="9" height="9" fill="none">
        <polyline
          points="2,5 4.2,7.5 8,3"
          stroke={checkColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function StatusPill({ status }) {
  const map = {
    Active:    { bg: '#E1F5EE', color: '#085041' },
    Injured:   { bg: '#FAECE7', color: '#712B13' },
    Suspended: { bg: '#FAEEDA', color: '#633806' },
  }
  const s = map[status] || map.Active
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {status || 'Active'}
    </span>
  )
}

function StatItem({ icon, value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'rgba(0,106,106,0.08)',
        border: '0.5px solid rgba(0,106,106,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, color: '#2D6B6B',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0D2B2B', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#5A8A8A', lineHeight: 1 }}>{label}</div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 * AthleteCard
 *
 * Props:
 *   athlete  — row from `athletes` table (with optional `coaches(name)` join)
 *   stats    — { matches, goals, assists, avgRating } — pass pre-computed values
 *              OR omit and the card shows placeholder dashes
 *   index    — avatar colour index (0-based position in a list)
 *   onConnect — callback for the Connect button
 *   onContact — callback for the Get in Touch button
 *   href     — if provided, wraps the identity section in a Link
 */
export default function AthleteCard({
  athlete = {},
  stats   = {},
  index   = 0,
  onConnect,
  onContact,
  href,
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [hovered,    setHovered]    = useState(false)

  const { matches = '—', goals = '—', assists = '—', avgRating = '—' } = stats

  // Format large numbers
  function fmt(n) {
    if (n === '—') return '—'
    const num = Number(n)
    if (isNaN(num)) return n
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
    return String(num)
  }

  const positionTag = athlete.position ? (
    <span style={{
      fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
      background: '#E6F1FB', color: '#0C447C',
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {athlete.position}
    </span>
  ) : null

  const nameSection = (
    <div style={{ flex: 1, minWidth: 0, paddingTop: 28 }}>
      <p style={{
        margin: '0 0 2px',
        fontSize: 14, fontWeight: 700,
        color: '#0D2B2B',
        display: 'flex', alignItems: 'center', gap: 5,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {athlete.name || 'Unknown Athlete'}
        <VerifiedBadge />
      </p>
      <p style={{
        margin: 0, fontSize: 11, color: '#5A8A8A',
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        {/* map-pin icon — inline SVG so no import needed */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        {athlete.region || athlete.club || 'Ghana'}
      </p>
    </div>
  )

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 280,
        borderRadius: 20,
        overflow: 'hidden',
        background: '#fff',
        border: `0.5px solid ${hovered ? 'rgba(0,106,106,0.25)' : '#E8F0EE'}`,
        boxShadow: hovered
          ? '0 8px 28px rgba(0,106,106,0.12), 0 2px 8px rgba(0,0,0,0.06)'
          : '0 2px 10px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* ── Banner ── */}
      <div style={{ height: 110, position: 'relative', overflow: 'hidden' }}>
        <BannerSVG />
      </div>

      {/* ── Identity row ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 10,
        padding: '0 14px', marginTop: -26, position: 'relative',
      }}>
        {/* Avatar with white ring */}
        <div style={{
          borderRadius: '50%',
          border: '3px solid #fff',
          flexShrink: 0,
          lineHeight: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <AthleteAvatar athlete={athlete} size={52} index={index} />
        </div>

        {/* Name / location */}
        {href ? (
          <Link href={href} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
            {nameSection}
          </Link>
        ) : nameSection}

        {/* Icon buttons */}
        <div style={{ display: 'flex', gap: 6, paddingTop: 28 }}>
          <button
            onClick={() => setBookmarked(b => !b)}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark athlete'}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: bookmarked ? '#E1F5EE' : '#F4F7F7',
              border: `0.5px solid ${bookmarked ? 'rgba(0,106,106,0.25)' : '#E8F0EE'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14,
              color: bookmarked ? '#006A6A' : '#5A8A8A',
              transition: 'all 0.15s',
            }}
          >
            {/* bookmark icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
          </button>
          <button
            onClick={() => navigator.clipboard?.writeText(href ? window.location.origin + href : window.location.href)}
            aria-label="Copy profile link"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: '#F4F7F7',
              border: '0.5px solid #E8F0EE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, color: '#5A8A8A',
              transition: 'all 0.15s',
            }}
          >
            {/* link icon */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Tags row ── */}
      <div style={{
        padding: '7px 14px 0',
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        {positionTag}
        <StatusPill status={athlete.status} />
        {athlete.club && (
          <span style={{
            fontSize: 10, color: '#5A8A8A', fontWeight: 500,
            marginLeft: 'auto', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110,
          }}>
            {athlete.club}
          </span>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '14px 10px 10px', gap: 0,
      }}>
        <StatItem
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4l2 2"/>
            </svg>
          }
          value={fmt(matches)}
          label="Matches"
        />
        <StatItem
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8l1.5 3 3.5.5-2.5 2.5.5 3.5L12 16l-3 1.5.5-3.5L7 11.5l3.5-.5z"/>
            </svg>
          }
          value={fmt(goals)}
          label="Goals"
        />
        <StatItem
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/>
            </svg>
          }
          value={fmt(assists)}
          label="Assists"
        />
        <StatItem
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          }
          value={avgRating !== '—' ? `${avgRating}` : '—'}
          label="Avg Rating"
        />
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '0.5px', background: '#E8F0EE', margin: '0 14px' }} />

      {/* ── Action buttons ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, padding: '10px 14px 14px',
      }}>
        <button
          onClick={onConnect}
          style={{
            height: 38, borderRadius: 19,
            border: '0.5px solid #C8E0E0',
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, color: '#0D2B2B',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#F4F7F7'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {/* user-plus icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Connect
        </button>

        <button
          onClick={onContact}
          style={{
            height: 38, borderRadius: 19,
            border: 'none',
            background: '#1D9E75',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: 12, fontWeight: 700, color: '#04342C',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {/* mail icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 7l10 7 10-7"/>
          </svg>
          Get in Touch
        </button>
      </div>
    </div>
  )
}