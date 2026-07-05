// lib/logger.js
// Structured JSON logger — Vercel captures JSON-format logs automatically.
// Use log.info/warn/error throughout API routes instead of raw console.*

const IS_DEV = process.env.NODE_ENV !== 'production'

function emit(level, message, meta = {}) {
  const entry = {
    time:    new Date().toISOString(),
    level,
    message,
    ...meta,
  }
  // Vercel ingests JSON lines from stdout/stderr. In development, pretty-print.
  if (IS_DEV) {
    const prefix = level === 'error' ? 'Error' : level === 'warn' ? 'Warn' : 'Info'
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
    console[level === 'info' ? 'log' : level](`${prefix} [${level.toUpperCase()}] ${message}${metaStr}`)
  } else {
    // Production: single-line JSON for Vercel log drains / external APM
    if (level === 'error') {
      console.error(JSON.stringify(entry))
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry))
    } else {
      console.log(JSON.stringify(entry))
    }
  }
}

export const log = {
  /** General informational event */
  info:  (message, meta = {}) => emit('info',  message, meta),
  /** Non-critical warning — review but not actionable immediately */
  warn:  (message, meta = {}) => emit('warn',  message, meta),
  /** Error that may impact a user or transaction */
  error: (message, meta = {}) => emit('error', message, meta),
}

export default log
