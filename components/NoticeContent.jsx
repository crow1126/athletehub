'use client'
import React from 'react'
import {
  Calendar, Clock, MapPin, Trophy, Layers, CheckCircle2,
  Users
} from 'lucide-react'

// Strip any stray emojis from strings
export function stripEmojis(str) {
  if (!str) return ''
  return str
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/  +/g, ' ')
    .trim()
}

/**
 * Mobile-optimised, icon-rich Notice Content Component.
 * Parses matchday structured fields and displays them in a clean grid/cards.
 * For general notices, renders clean typography with full newline preservation.
 */
export default function NoticeContent({ notice }) {
  if (!notice) return null
  const raw = stripEmojis(notice.content || '')

  // ── MATCHDAY CALL-UP FORMATTER ──
  if (notice.category === 'matchday') {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    
    // Parse key fields
    const fields = {}
    const startingXI = []
    const bench = []
    const instructions = []
    let currentSection = null

    for (const line of lines) {
      if (/^STARTING XI/i.test(line)) {
        currentSection = 'xi'
        continue
      }
      if (/^BENCH|^SUBSTITUTES/i.test(line)) {
        currentSection = 'bench'
        continue
      }
      if (line.startsWith('—') || line.startsWith('-') || /^Coach Instructions:/i.test(line)) {
        currentSection = 'notes'
        if (!line.startsWith('Coach Instructions:')) {
          instructions.push(line.replace(/^[—-]\s*/, ''))
        }
        continue
      }

      if (currentSection === 'xi') {
        if (/^\d+\./.test(line)) {
          startingXI.push(line.replace(/^\d+\.\s*/, ''))
        }
        continue
      }

      if (currentSection === 'bench') {
        if (/^\d+\./.test(line)) {
          bench.push(line.replace(/^\d+\.\s*/, ''))
        }
        continue
      }

      if (currentSection === 'notes') {
        instructions.push(line.replace(/^[—-]\s*/, ''))
        continue
      }

      // Parse metadata lines
      const lower = line.toLowerCase()
      if (lower.startsWith('fixture:')) fields.fixture = line.slice(8).trim()
      else if (lower.startsWith('date:')) fields.date = line.slice(5).trim()
      else if (lower.startsWith('kickoff:')) fields.kickoff = line.slice(8).trim()
      else if (lower.startsWith('venue:')) fields.venue = line.slice(6).trim()
      else if (lower.startsWith('meeting point:')) fields.meetingPoint = line.slice(14).trim()
      else if (lower.startsWith('meeting time:')) fields.meetingTime = line.slice(13).trim()
      else if (lower.startsWith('competition:')) fields.competition = line.slice(12).trim()
      else if (lower.startsWith('formation:')) fields.formation = line.slice(10).trim()
    }

    const hasStructured = Object.keys(fields).length > 0 || startingXI.length > 0 || bench.length > 0

    if (hasStructured) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          {/* Matchday Meta Badges Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
            gap: 8,
            background: '#F8FAFC',
            padding: '10px 12px',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}>
            {fields.date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Calendar size={13} color="#0D9488" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>Date:</strong> {fields.date}</span>
              </div>
            )}
            {fields.kickoff && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Clock size={13} color="#EF4444" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>Kickoff:</strong> {fields.kickoff}</span>
              </div>
            )}
            {fields.venue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <MapPin size={13} color="#3B82F6" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>Venue:</strong> {fields.venue}</span>
              </div>
            )}
            {fields.meetingTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Clock size={13} color="#D97706" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>Meet:</strong> {fields.meetingTime}</span>
              </div>
            )}
            {fields.meetingPoint && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <MapPin size={13} color="#8B5CF6" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>Point:</strong> {fields.meetingPoint}</span>
              </div>
            )}
            {fields.competition && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Trophy size={13} color="#059669" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>Comp:</strong> {fields.competition}</span>
              </div>
            )}
            {fields.formation && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Layers size={13} color="#64748B" style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}><strong>System:</strong> {fields.formation}</span>
              </div>
            )}
          </div>

          {/* Starting XI */}
          {startingXI.length > 0 && (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 800,
                color: '#166534',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 6,
              }}>
                <CheckCircle2 size={13} color="#16A34A" />
                Starting XI ({startingXI.length})
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 5,
              }}>
                {startingXI.map((player, idx) => (
                  <div key={idx} style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#14532D',
                    background: '#DCFCE7',
                    padding: '3px 8px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <span style={{ fontSize: 10, color: '#16A34A', fontWeight: 800 }}>{idx + 1}.</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bench / Substitutes */}
          {bench.length > 0 && (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 10,
              padding: '10px 12px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 800,
                color: '#1E40AF',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 6,
              }}>
                <Users size={13} color="#2563EB" />
                Substitutes ({bench.length})
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 5,
              }}>
                {bench.map((player, idx) => (
                  <div key={idx} style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#1E3A8A',
                    background: '#DBEAFE',
                    padding: '3px 8px',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}>
                    <span style={{ fontSize: 10, color: '#2563EB', fontWeight: 800 }}>{startingXI.length + idx + 1}.</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coach instructions / notes */}
          {instructions.length > 0 && (
            <div style={{
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              color: '#92400E',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              {instructions.map((inst, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontWeight: 800, color: '#D97706' }}>•</span>
                  <span>{inst}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  // ── STANDARD NOTICE FORMATTER ──
  return (
    <div style={{
      fontSize: 13,
      color: '#334155',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      margin: 0,
    }}>
      {raw}
    </div>
  )
}
