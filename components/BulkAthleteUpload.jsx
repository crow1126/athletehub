'use client'
/**
 * components/BulkAthleteUpload.jsx
 *
 * Admin-only bulk athlete upload modal.
 * Props:
 *   teamId    {string}   — current team UUID (must be truthy to submit)
 *   onClose   {() => void}
 *   onSuccess {({ added, skipped }) => void}
 */
import { useState, useRef, useCallback } from 'react'
import { parseAthleteFile } from '@/lib/parseAthletes'
import { fetchWithAuth } from '@/lib/tenant'

// ─── Shared style tokens (matches athletes/page.jsx palette) ──────────────────
const TEAL       = '#0F766E'
const TEAL_MID   = '#0D9488'
const TEAL_LIGHT = '#CCFBF1'
const TEAL_BG    = '#F0FDFA'
const SLATE      = '#334155'
const MUTED      = '#64748B'
const BORDER     = '#E2E8F0'
const RED_BG     = '#FFE4E6'
const RED        = '#E11D48'
const GREEN      = '#059669'
const GREEN_BG   = '#ECFDF5'
const ORANGE_BG  = '#FEF3C7'
const ORANGE     = '#B45309'

const btn = {
  base: {
    padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--font)', border: 'none', transition: 'opacity 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  primary: { background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})`, color: '#fff', boxShadow: '0 4px 12px rgba(13,148,136,0.25)' },
  ghost:   { background: '#F8FAFC', border: `1px solid ${BORDER}`, color: SLATE },
  danger:  { background: RED_BG, color: RED },
}

// ─── Tiny status icons ────────────────────────────────────────────────────────
function IconOk()   { return <span style={{ color: GREEN,  fontSize: 16, lineHeight: 1 }}>✓</span> }
function IconErr()  { return <span style={{ color: RED,    fontSize: 16, lineHeight: 1 }}>✗</span> }
function IconWarn() { return <span style={{ color: ORANGE, fontSize: 14, lineHeight: 1 }}>⚠</span> }

// ─── Drop-zone ────────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  const handleChange = useCallback(e => {
    const f = e.target.files[0]
    if (f) { onFile(f); e.target.value = '' }
  }, [onFile])

  return (
    <div
      onDragEnter={e => { e.preventDefault(); setDragging(true) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? TEAL_MID : BORDER}`,
        borderRadius: 14, padding: '36px 24px', textAlign: 'center',
        background: dragging ? TEAL_BG : '#FAFAFA',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: SLATE }}>
        {dragging ? 'Release to upload' : 'Drop your CSV or Excel file here'}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: MUTED }}>
        or click to browse · .csv and .xlsx accepted
      </p>
      <input
        ref={inputRef}
        id="bulk-file-input"
        type="file"
        accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  )
}

// ─── Preview table ────────────────────────────────────────────────────────────
function PreviewTable({ rows }) {
  const cols = [
    { key: '_status', label: '' },
    { key: 'full_name',    label: 'Full Name' },
    { key: 'position',     label: 'Position' },
    { key: 'date_of_birth',label: 'DOB' },
    { key: 'back_number',  label: 'Jersey #' },
    { key: 'phone',        label: 'Phone' },
    { key: 'email',        label: 'Email' },
  ]

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${BORDER}`, marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${BORDER}` }}>
            {cols.map(c => (
              <th key={c.key} style={{
                padding: '9px 12px', textAlign: 'left',
                fontSize: 10, fontWeight: 700, color: MUTED,
                textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                borderBottom: `1px solid ${BORDER}`,
                background: row._valid ? 'transparent' : '#FFF8F8',
                transition: 'background 0.1s',
              }}
            >
              {/* Status icon */}
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {row._valid ? <IconOk /> : <IconErr />}
              </td>
              {/* full_name */}
              <td style={{ padding: '8px 12px', fontWeight: 600, color: SLATE, whiteSpace: 'nowrap' }}>
                {row.full_name || <span style={{ color: RED, fontStyle: 'italic' }}>missing</span>}
              </td>
              {/* position */}
              <td style={{ padding: '8px 12px', color: row.position ? TEAL : RED }}>
                {row.position || <span style={{ fontStyle: 'italic' }}>missing</span>}
              </td>
              {/* date_of_birth */}
              <td style={{ padding: '8px 12px', color: SLATE }}>{row.date_of_birth || '—'}</td>
              {/* back_number */}
              <td style={{ padding: '8px 12px', color: SLATE }}>{row.back_number || '—'}</td>
              {/* phone */}
              <td style={{ padding: '8px 12px', color: SLATE }}>{row.phone || '—'}</td>
              {/* email */}
              <td style={{ padding: '8px 12px', color: SLATE, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {row.email || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Inline error reasons */}
      {rows.some(r => !r._valid) && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, background: '#FFF8F8' }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Validation errors
          </p>
          {rows.filter(r => !r._valid).map((row, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: SLATE, fontSize: 12 }}>
                Row {row._rowIndex + 1} {row.full_name ? `(${row.full_name})` : ''}:
              </span>
              <ul style={{ margin: '2px 0 0 16px', padding: 0, listStyle: 'disc' }}>
                {row._errors.map((e, ei) => (
                  <li key={ei} style={{ fontSize: 12, color: RED }}>{e}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BulkAthleteUpload({ teamId, onClose, onSuccess }) {
  // view: 'idle' | 'parsing' | 'preview' | 'importing' | 'result'
  const [view,        setView]       = useState('idle')
  const [rows,        setRows]       = useState([])
  const [parseError,  setParseError] = useState(null)
  const [importError, setImportError]= useState(null)
  const [result,      setResult]     = useState(null) // { added, skipped }
  const [fileName,    setFileName]   = useState('')

  const validRows   = rows.filter(r => r._valid)
  const invalidRows = rows.filter(r => !r._valid)

  // ── File chosen ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    setParseError(null)
    setFileName(file.name)
    setView('parsing')
    const { rows: parsed, error } = await parseAthleteFile(file)
    if (error) {
      setParseError(error)
      setView('idle')
      return
    }
    setRows(parsed)
    setView('preview')
  }, [])

  // ── Import confirmed ─────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!validRows.length || !teamId) return
    setImportError(null)
    setView('importing')

    // Strip internal fields before sending
    const payload = validRows.map(({ full_name, date_of_birth, position, back_number, phone, email }) => ({
      full_name, date_of_birth, position, back_number, phone, email,
    }))

    try {
      const res = await fetchWithAuth('/api/athletes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, rows: payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        // 422 = probe insert failed — show the exact DB error
        const errMsg = data?.errors?.length
          ? data.errors.join('\n')
          : (data?.error || `Server error (${res.status})`)
        setImportError(errMsg)
        setView('preview')
        return
      }
      setResult({ added: data.added ?? 0, skipped: data.skipped ?? 0, errors: data.errors || [] })
      setView('result')
      onSuccess?.({ added: data.added ?? 0, skipped: data.skipped ?? 0 })
    } catch (err) {
      setImportError('Network error. Please check your connection and try again.')
      setView('preview')
    }
  }, [validRows, teamId, onSuccess])

  // ── Reset to upload another ───────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setRows([]); setResult(null); setParseError(null); setImportError(null)
    setFileName(''); setView('idle')
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bulk athlete upload"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.65)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 760,
        maxHeight: '92vh',
        overflow: 'auto',
        boxShadow: '0 25px 60px -10px rgba(0,0,0,0.28)',
        border: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(135deg, ${TEAL}, ${TEAL_MID})`,
          padding: '18px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          borderRadius: '20px 20px 0 0',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
              Admin Tool
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
              Bulk Athlete Upload
            </h2>
            {fileName && view !== 'idle' && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                📄 {fileName}
              </p>
            )}
          </div>
          <button
            id="bulk-upload-close"
            onClick={onClose}
            aria-label="Close bulk upload"
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
              width: 36, height: 36, borderRadius: '50%', fontSize: 20,
              cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

          {/* Parse error */}
          {parseError && (
            <div style={{ background: RED_BG, border: '1px solid rgba(225,29,72,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: RED, fontWeight: 600, display: 'flex', gap: 8 }}>
              <IconErr /> {parseError}
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div style={{ background: RED_BG, border: '1px solid rgba(225,29,72,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: RED, fontWeight: 600, display: 'flex', gap: 8 }}>
              <IconErr /> {importError}
            </div>
          )}

          {/* ── IDLE ── */}
          {view === 'idle' && (
            <>
              {/* Template download */}
              <div style={{ background: TEAL_BG, border: `1px solid ${TEAL_LIGHT}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEAL }}>Step 1 — Download the template</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>
                    Columns: full_name, date_of_birth, position, jersey_number, phone, email
                  </p>
                </div>
                <a
                  id="bulk-template-download"
                  href="/templates/athlete-import-template.csv"
                  download="athlete-import-template.csv"
                  style={{ ...btn.base, ...btn.ghost, textDecoration: 'none', fontSize: 12 }}
                >
                  ⬇ Download Template
                </a>
              </div>

              {/* Drop zone */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: SLATE }}>
                  Step 2 — Upload your completed file
                </p>
                <DropZone onFile={handleFile} disabled={false} />
              </div>
            </>
          )}

          {/* ── PARSING ── */}
          {view === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `4px solid ${TEAL_LIGHT}`, borderTopColor: TEAL_MID,
                animation: 'spin 0.7s linear infinite', margin: '0 auto 14px',
              }} />
              <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Parsing file…</p>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {(view === 'preview' || view === 'importing') && (
            <>
              {/* Summary banner */}
              <div style={{
                display: 'flex', gap: 10, flexWrap: 'wrap',
              }}>
                <div style={{ background: GREEN_BG, border: '1px solid #A7F3D0', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: GREEN, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconOk /> {validRows.length} ready to import
                </div>
                {invalidRows.length > 0 && (
                  <div style={{ background: RED_BG, border: '1px solid rgba(225,29,72,0.2)', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: RED, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconErr /> {invalidRows.length} invalid (will be skipped)
                  </div>
                )}
                <div style={{ background: ORANGE_BG, border: '1px solid #FCD34D', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: ORANGE, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconWarn /> {rows.length} rows total
                </div>
              </div>

              {/* Preview table */}
              <PreviewTable rows={rows} />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                <button
                  id="bulk-upload-cancel"
                  onClick={handleReset}
                  disabled={view === 'importing'}
                  style={{ ...btn.base, ...btn.ghost, opacity: view === 'importing' ? 0.5 : 1 }}
                >
                  ← Upload different file
                </button>
                <button
                  id="bulk-upload-import"
                  onClick={handleImport}
                  disabled={validRows.length === 0 || view === 'importing'}
                  style={{
                    ...btn.base, ...btn.primary,
                    flex: 1, justifyContent: 'center',
                    opacity: (validRows.length === 0 || view === 'importing') ? 0.6 : 1,
                    cursor: (validRows.length === 0 || view === 'importing') ? 'not-allowed' : 'pointer',
                  }}
                >
                  {view === 'importing'
                    ? <><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} /> Importing…</>
                    : `Import ${validRows.length} athlete${validRows.length !== 1 ? 's' : ''}`
                  }
                </button>
              </div>
            </>
          )}

          {/* ── RESULT ── */}
          {view === 'result' && result && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {result.added > 0 ? '🎉' : '⚠️'}
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: SLATE }}>
                Import complete
              </h3>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ background: GREEN_BG, border: '1px solid #A7F3D0', borderRadius: 12, padding: '12px 24px' }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: GREEN }}>{result.added}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED, fontWeight: 600 }}>athletes added</p>
                </div>
                {result.skipped > 0 && (
                  <div style={{ background: ORANGE_BG, border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 24px' }}>
                    <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: ORANGE }}>{result.skipped}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED, fontWeight: 600 }}>skipped (DB errors)</p>
                  </div>
                )}
              </div>

              {/* DB error details */}
              {result.errors?.length > 0 && (
                <div style={{ background: '#FFF8F8', border: `1px solid rgba(225,29,72,0.15)`, borderRadius: 10, padding: '12px 16px', textAlign: 'left', maxHeight: 160, overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: RED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skip reasons</p>
                  {result.errors.map((e, i) => (
                    <p key={i} style={{ margin: '2px 0', fontSize: 12, color: RED }}>{e}</p>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  id="bulk-upload-another"
                  onClick={handleReset}
                  style={{ ...btn.base, ...btn.ghost }}
                >
                  Upload another file
                </button>
                <button
                  id="bulk-upload-done"
                  onClick={onClose}
                  style={{ ...btn.base, ...btn.primary }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* spin keyframe (injected inline once) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
