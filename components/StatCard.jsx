'use client'
import { useState } from 'react'

export default function StatCard({ label, value, note, icon, accent, trend, href }) {
  const [hovered, setHovered] = useState(false)

  const accentColor = accent || '#008080'

  const card = (
    <div
      className="fade-up"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 20px 18px',
        borderRadius: 20,
        background: hovered
          ? `linear-gradient(145deg, rgba(255,255,255,0.92) 0%, ${accentColor}18 55%, ${accentColor}12 100%)`
          : `linear-gradient(145deg, rgba(255,255,255,0.82) 0%, ${accentColor}10 55%, ${accentColor}0a 100%)`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: `1px solid ${hovered ? `${accentColor}35` : 'rgba(255,255,255,0.72)'}`,
        boxShadow: hovered
          ? `0 10px 36px ${accentColor}20, 0 2px 8px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.9)`
          : `0 4px 18px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.85)`,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.22s ease',
        cursor: href ? 'pointer' : 'default',
        textDecoration: 'none',
        display: 'block',
        fontFamily: 'var(--font)',
      }}
    >
      {/* Decorative glow blob */}
      <div style={{
        position: 'absolute',
        top: -28,
        right: -28,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: `${accentColor}14`,
        pointerEvents: 'none',
        transition: 'opacity 0.22s',
        opacity: hovered ? 1 : 0.6,
      }}/>

      {/* Top row: icon + trend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative' }}>
        {/* Icon pill */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}14)`,
          border: `1.5px solid ${accentColor}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
          boxShadow: `0 2px 10px ${accentColor}18`,
        }}>
          {icon}
        </div>

        {/* Trend badge */}
        {trend && (
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: trend.startsWith('+') ? '#0e8a3e' : '#c0392b',
            background: trend.startsWith('+') ? 'rgba(14,138,62,0.1)' : 'rgba(192,57,43,0.1)',
            border: `1px solid ${trend.startsWith('+') ? 'rgba(14,138,62,0.2)' : 'rgba(192,57,43,0.2)'}`,
            padding: '4px 9px',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            backdropFilter: 'blur(6px)',
          }}>
            {trend.startsWith('+') ? '↑' : '↓'} {trend}
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{
        fontSize: 30,
        fontWeight: 900,
        color: '#111',
        lineHeight: 1,
        marginBottom: 5,
        letterSpacing: '-0.03em',
        position: 'relative',
      }}>
        {value}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 13,
        color: '#555',
        fontWeight: 500,
        marginBottom: note ? 5 : 0,
        position: 'relative',
      }}>
        {label}
      </div>

      {/* Note */}
      {note && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: accentColor,
          background: `${accentColor}12`,
          border: `1px solid ${accentColor}22`,
          padding: '3px 9px',
          borderRadius: 20,
          position: 'relative',
        }}>
          {note}
        </div>
      )}

      {/* Bottom accent bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${accentColor}50, ${accentColor}18)`,
        borderRadius: '0 0 20px 20px',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.22s ease',
      }}/>
    </div>
  )

  if (href) {
    return (
      <a href={href} style={{ textDecoration: 'none', display: 'block' }}>
        {card}
      </a>
    )
  }

  return card
}