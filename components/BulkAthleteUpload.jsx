'use client'
/**
 * components/BulkAthleteUpload.jsx
 *
 * Admin-only bulk athlete upload modal with column mapping step.
 * Props:
 *   teamId    {string}   — current team UUID (must be truthy to submit)
 *   onClose   {() => void}
 *   onSuccess {({ added, skipped }) => void}
 */
import { useState, useRef, useCallback } from 'react'
import {
  extractSpreadsheetData,
  matchHeadersLocally,
  transformAndValidateRows,
  EXPECTED_FIELDS,
} from '@/lib/parseAthletes'
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
const PURPLE_BG  = '#FAF5FF'
const PURPLE     = '#7E22CE'
const PURPLE_BRD = '#E9D5FF'

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

// ─── Column Mapping Component ─────────────────────────────────────────────────
function ColumnMappingView({
  headers,
  mapping,
  matchSources,
  onMappingChange,
  onConfirm,
  onCancel,
  rememberMapping,
  setRememberMapping,
  hasAiSuggestions,
}) {
  // Check for duplicate assignments (different fields mapping to same non-empty header)
  const mappedCounts = {}
  Object.values(mapping).forEach(header => {
    if (header) {
      mappedCounts[header] = (mappedCounts[header] || 0) + 1
    }
  })
  const duplicates = Object.keys(mappedCounts).filter(h => mappedCounts[h] > 1)

  const isFullNameMapped = Boolean(mapping.full_name || mapping.first_name)
  const canProceed = isFullNameMapped && duplicates.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Informative notification */}
      <div style={{
        background: hasAiSuggestions ? PURPLE_BG : TEAL_BG,
        border: `1px solid ${hasAiSuggestions ? PURPLE_BRD : TEAL_LIGHT}`,
        borderRadius: 12, padding: '12px 16px',
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: hasAiSuggestions ? PURPLE : TEAL }}>
          {hasAiSuggestions ? '✨ AI Column Matching Applied' : '📋 Match Columns to Profile Fields'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: SLATE, lineHeight: 1.4 }}>
          {hasAiSuggestions
            ? 'We used local rules and Gemini AI to suggest matches for your file headers. Please review and confirm below before proceeding.'
            : 'Match each profile field to the corresponding column header from your uploaded file. Full Name (or First Name) is required.'}
        </p>
      </div>

      {duplicates.length > 0 && (
        <div style={{ background: ORANGE_BG, border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: ORANGE, fontWeight: 600 }}>
          <IconWarn /> The column header &quot;{duplicates.join(', ')}&quot; is mapped to multiple fields. Each field must use a unique column.
        </div>
      )}

      {!isFullNameMapped && (
        <div style={{ background: RED_BG, border: '1px solid rgba(225,29,72,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: RED, fontWeight: 600 }}>
          <IconErr /> Full Name or First Name is required. Please map a column to continue.
        </div>
      )}

      {/* Field mapping list */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        border: `1px solid ${BORDER}`, borderRadius: 14,
        background: '#fff', overflow: 'hidden', padding: 8,
      }}>
        {EXPECTED_FIELDS.map(f => {
          const selectedHeader = mapping[f.key] || ''
          const source = matchSources[f.key]
          const isDuplicate = selectedHeader && mappedCounts[selectedHeader] > 1

          return (
            <div
              key={f.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                background: isDuplicate ? '#FFF8F8' : '#F8FAFC',
                border: `1px solid ${isDuplicate ? 'rgba(225,29,72,0.2)' : BORDER}`,
                flexWrap: 'wrap', gap: 12,
              }}
            >
              {/* Field Label & Description */}
              <div style={{ minWidth: 200, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: SLATE }}>
                    {f.label}
                  </span>
                  {f.required ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: RED, background: RED_BG, padding: '1px 6px', borderRadius: 4 }}>
                      Required
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: MUTED }}>Optional</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  {f.description}
                </div>
              </div>

              {/* Status Badge & Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Badge */}
                {source === 'local' && selectedHeader && (
                  <span style={{ background: TEAL_BG, color: TEAL, border: `1px solid ${TEAL_LIGHT}`, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    ⚡ Auto-matched
                  </span>
                )}
                {source === 'ai' && selectedHeader && (
                  <span style={{ background: PURPLE_BG, color: PURPLE, border: `1px solid ${PURPLE_BRD}`, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    ✨ AI suggested
                  </span>
                )}
                {source === 'saved' && selectedHeader && (
                  <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                    💾 Saved
                  </span>
                )}
                {source === 'manual' && selectedHeader && (
                  <span style={{ background: '#F1F5F9', color: SLATE, border: `1px solid ${BORDER}`, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                    ✎ Selected
                  </span>
                )}
                {!selectedHeader && (
                  <span style={{ background: '#F1F5F9', color: MUTED, border: `1px solid ${BORDER}`, padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>
                    Unmapped
                  </span>
                )}

                {/* Dropdown */}
                <select
                  id={`mapping-select-${f.key}`}
                  value={selectedHeader}
                  onChange={e => onMappingChange(f.key, e.target.value)}
                  style={{
                    padding: '8px 12px', borderRadius: 8,
                    border: `1px solid ${isDuplicate ? RED : selectedHeader ? TEAL_MID : BORDER}`,
                    background: '#fff', fontSize: 13, fontWeight: 600, color: SLATE,
                    minWidth: 200, cursor: 'pointer', outline: 'none',
                  }}
                >
                  <option value="">-- Do not import (Unmapped) --</option>
                  {headers.map(h => (
                    <option key={h} value={h}>
                      Column: {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      {/* Remember mapping checkbox */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: SLATE, userSelect: 'none' }}>
        <input
          id="remember-mapping-checkbox"
          type="checkbox"
          checked={rememberMapping}
          onChange={e => setRememberMapping(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: TEAL }}
        />
        <span>Remember this column mapping for this team (future exports skip this screen)</span>
      </label>

      {/* Bottom actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6 }}>
        <button
          id="bulk-mapping-cancel"
          onClick={onCancel}
          style={{ ...btn.base, ...btn.ghost }}
        >
          ← Choose different file
        </button>
        <button
          id="bulk-mapping-confirm"
          onClick={onConfirm}
          disabled={!canProceed}
          style={{
            ...btn.base, ...btn.primary,
            flex: 1, justifyContent: 'center',
            opacity: canProceed ? 1 : 0.5,
            cursor: canProceed ? 'pointer' : 'not-allowed',
          }}
        >
          Confirm Mapping & Preview →
        </button>
      </div>
    </div>
  )
}

// ─── Preview table ────────────────────────────────────────────────────────────
function PreviewTable({ rows }) {
  const cols = [
    { key: '_status', label: '' },
    { key: 'full_name',    label: 'Full Name' },
    { key: 'status',       label: 'Status' },
    { key: 'position',     label: 'Position' },
    { key: 'date_of_birth',label: 'DOB' },
    { key: 'back_number',  label: 'Jersey #' },
    { key: 'phone',        label: 'Phone' },
    { key: 'nationality',  label: 'Nationality' },
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
              {/* status */}
              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: row.status === 'Injured' ? '#FEE2E2' : row.status === 'Suspended' ? '#FEF3C7' : '#ECFDF5',
                  color: row.status === 'Injured' ? '#DC2626' : row.status === 'Suspended' ? '#B45309' : '#059669',
                }}>
                  {row.status || 'Active'}
                </span>
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
              {/* nationality */}
              <td style={{ padding: '8px 12px', color: SLATE }}>{row.nationality || '—'}</td>
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
  // view: 'idle' | 'reading' | 'mapping' | 'preview' | 'importing' | 'result'
  const [view,                 setView]                = useState('idle')
  const [loadingText,          setLoadingText]         = useState('Reading file…')
  const [fileHeaders,          setFileHeaders]         = useState([])
  const [rawFileRows,          setRawFileRows]         = useState([])
  const [mapping,              setMapping]             = useState({})
  const [matchSources,         setMatchSources]        = useState({})
  const [hasAiSuggestions,     setHasAiSuggestions]    = useState(false)
  const [usedSavedMapping,     setUsedSavedMapping]    = useState(false)
  const [rememberMapping,      setRememberMapping]     = useState(true)
  const [rows,                 setRows]                = useState([])
  const [parseError,           setParseError]          = useState(null)
  const [importError,          setImportError]         = useState(null)
  const [result,               setResult]              = useState(null) // { added, skipped }
  const [fileName,             setFileName]            = useState('')

  const validRows   = rows.filter(r => r._valid)
  const invalidRows = rows.filter(r => !r._valid)

  const storageKey = teamId ? `apextrack_bulk_mapping_${teamId}` : null

  // ── File chosen ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    setParseError(null)
    setFileName(file.name)
    setUsedSavedMapping(false)
    setHasAiSuggestions(false)
    setView('reading')
    setLoadingText('Reading file…')

    const { headers, rawRows, error } = await extractSpreadsheetData(file)
    if (error) {
      setParseError(error)
      setView('idle')
      return
    }

    setFileHeaders(headers)
    setRawFileRows(rawRows)

    // Check if team has a saved mapping in localStorage that matches this file's headers
    let saved = null
    if (storageKey) {
      try {
        const rawSaved = localStorage.getItem(storageKey)
        if (rawSaved) saved = JSON.parse(rawSaved)
      } catch (err) {
        console.warn('Failed to read saved mapping from localStorage', err)
      }
    }

    const headersMatch = saved && Array.isArray(saved.headers) &&
      saved.headers.length === headers.length &&
      saved.headers.every((h, i) => h === headers[i])

    if (headersMatch && saved.mapping && saved.mapping.full_name) {
      // Repeat upload of same export format: apply saved mapping and skip mapping screen
      const transformed = transformAndValidateRows(rawRows, headers, saved.mapping)
      if (!transformed.error && transformed.rows.length > 0) {
        setMapping(saved.mapping)
        const sources = {}
        Object.keys(saved.mapping).forEach(k => {
          if (saved.mapping[k]) sources[k] = 'saved'
        })
        setMatchSources(sources)
        setRows(transformed.rows)
        setUsedSavedMapping(true)
        setView('preview')
        return
      }
    }

    // Step 2: Run fast local fuzzy matching first
    const localResult = matchHeadersLocally(headers)
    const initialMapping = { ...localResult.mapping }
    const initialSources = { ...localResult.matchedTypes }

    // Step 3: Check if there are unmapped expected fields to send to Gemini
    if (localResult.unmappedFields.length > 0 && localResult.unmappedHeaders.length > 0) {
      setLoadingText('Analyzing column headers with AI…')
      try {
        const res = await fetchWithAuth('/api/athletes/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'suggest_mapping',
            team_id: teamId,
            unmappedHeaders: localResult.unmappedHeaders,
            unmappedFields: localResult.unmappedFields,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data?.suggestions) {
            let aiFoundAny = false
            for (const [field, matchedHeader] of Object.entries(data.suggestions)) {
              if (matchedHeader && !initialMapping[field]) {
                initialMapping[field] = matchedHeader
                initialSources[field] = 'ai'
                aiFoundAny = true
              }
            }
            if (aiFoundAny) {
              setHasAiSuggestions(true)
            }
          }
        }
      } catch (err) {
        console.warn('[bulk-athletes] AI suggestion fetch failed:', err)
      }
    }

    setMapping(initialMapping)
    setMatchSources(initialSources)
    setView('mapping')
  }, [storageKey, teamId])

  // ── Mapping field changed by user ─────────────────────────────────────────
  const handleMappingChange = useCallback((fieldKey, selectedHeader) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: selectedHeader || null,
    }))
    setMatchSources(prev => ({
      ...prev,
      [fieldKey]: selectedHeader ? 'manual' : null,
    }))
  }, [])

  // ── Confirm Mapping & Proceed to Preview ─────────────────────────────────
  const handleConfirmMapping = useCallback(() => {
    if (!mapping.full_name && !mapping.first_name) return

    // Save mapping if opted in
    if (rememberMapping && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          headers: fileHeaders,
          mapping,
          updatedAt: Date.now(),
        }))
      } catch (err) {
        console.warn('Failed to persist column mapping', err)
      }
    }

    const { rows: transformedRows, error } = transformAndValidateRows(rawFileRows, fileHeaders, mapping)
    if (error) {
      setParseError(error)
      return
    }

    setRows(transformedRows)
    setView('preview')
  }, [mapping, rememberMapping, storageKey, fileHeaders, rawFileRows])

  // ── Import confirmed ─────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!validRows.length || !teamId) return
    setImportError(null)
    setView('importing')

    // Strip internal fields before sending, forwarding all parsed biodata
    const payload = validRows.map(({ _rowIndex, _valid, _errors, ...athleteData }) => athleteData)

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
    } catch {
      setImportError('Network error. Please check your connection and try again.')
      setView('preview')
    }
  }, [validRows, teamId, onSuccess])

  // ── Reset to upload another ───────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setRows([]); setResult(null); setParseError(null); setImportError(null)
    setFileName(''); setFileHeaders([]); setRawFileRows([]); setMapping({})
    setMatchSources({}); setHasAiSuggestions(false); setUsedSavedMapping(false)
    setView('idle')
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
        maxWidth: 780,
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
                📄 {fileName} {fileHeaders.length > 0 ? `(${fileHeaders.length} columns detected)` : ''}
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
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEAL }}>Step 1 — Download standard template (optional)</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED }}>
                    Columns: full_name, date_of_birth, position, jersey_number, phone, email. Custom headers are also supported!
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
                  Step 2 — Upload your spreadsheet file
                </p>
                <DropZone onFile={handleFile} disabled={false} />
              </div>
            </>
          )}

          {/* ── READING & AI PROCESSING ── */}
          {view === 'reading' && (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `4px solid ${TEAL_LIGHT}`, borderTopColor: TEAL_MID,
                animation: 'spin 0.7s linear infinite', margin: '0 auto 14px',
              }} />
              <p style={{ color: SLATE, fontSize: 14, fontWeight: 600, margin: 0 }}>{loadingText}</p>
              <p style={{ color: MUTED, fontSize: 12, margin: '6px 0 0' }}>Parsing headers and optimizing mappings…</p>
            </div>
          )}

          {/* ── COLUMN MAPPING VIEW ── */}
          {view === 'mapping' && (
            <ColumnMappingView
              headers={fileHeaders}
              mapping={mapping}
              matchSources={matchSources}
              onMappingChange={handleMappingChange}
              onConfirm={handleConfirmMapping}
              onCancel={handleReset}
              rememberMapping={rememberMapping}
              setRememberMapping={setRememberMapping}
              hasAiSuggestions={hasAiSuggestions}
            />
          )}

          {/* ── PREVIEW ── */}
          {(view === 'preview' || view === 'importing') && (
            <>
              {/* Saved mapping banner if used */}
              {usedSavedMapping && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <span>💾 Automatically used your saved column mapping for this team format.</span>
                  <button
                    id="bulk-upload-edit-mapping-saved"
                    onClick={() => setView('mapping')}
                    style={{ background: 'none', border: 'none', color: '#1D4ED8', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}
                  >
                    Adjust Mapping
                  </button>
                </div>
              )}

              {/* Summary banner */}
              <div style={{
                display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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

                {/* Button to edit mapping */}
                <button
                  id="bulk-upload-edit-mapping"
                  onClick={() => setView('mapping')}
                  disabled={view === 'importing'}
                  style={{ ...btn.base, ...btn.ghost, fontSize: 12, padding: '6px 12px' }}
                >
                  ⚙ Edit Mapping
                </button>
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

