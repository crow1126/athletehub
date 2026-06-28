// lib/rateLimit.js
// In-memory sliding window rate limiter.
//
// ⚠️  Vercel serverless functions are stateless — each cold start gets a fresh
//     in-memory map. This provides meaningful throttling within a warm instance
//     and deters scripted abuse, but is not a distributed rate limiter.
//     For production at scale, swap the store for Redis (Upstash) or Vercel KV.
//
// Usage:
//   import { rateLimit } from '@/lib/rateLimit'
//   const limiter = rateLimit({ windowMs: 60_000, max: 10 })
//   const result  = await limiter(req)
//   if (!result.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

import { NextResponse } from 'next/server'

/**
 * Extract the best-available client IP from a Next.js App Router request.
 */
function getClientIp(req) {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * Create a rate limiter function.
 * @param {object} options
 * @param {number} options.windowMs  - Rolling window size in milliseconds (default 60 000)
 * @param {number} options.max       - Max requests allowed per window per key (default 20)
 * @param {string} [options.keyPrefix] - Prefix to namespace multiple limiters
 * @returns {(req: Request, customKey?: string) => { ok: boolean, remaining: number, response?: Response }}
 */
export function rateLimit({ windowMs = 60_000, max = 20, keyPrefix = '' } = {}) {
  // Map<key, Array<timestamp>>
  const store = new Map()

  // Prune old entries every 5 minutes to avoid unbounded memory growth
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      const now = Date.now()
      for (const [key, hits] of store) {
        const fresh = hits.filter(t => now - t < windowMs)
        if (fresh.length === 0) store.delete(key)
        else store.set(key, fresh)
      }
    }, 5 * 60_000).unref?.()
  }

  return function limiter(req, customKey) {
    const ip  = getClientIp(req)
    const key = `${keyPrefix}:${customKey || ip}`
    const now = Date.now()

    const hits   = (store.get(key) || []).filter(t => now - t < windowMs)
    const count  = hits.length

    if (count >= max) {
      const resetAt = Math.min(...hits) + windowMs
      const retryAfter = Math.ceil((resetAt - now) / 1000)
      return {
        ok:        false,
        remaining: 0,
        response:  NextResponse.json(
          { error: 'Too many requests. Please slow down and try again shortly.' },
          {
            status: 429,
            headers: {
              'Retry-After':           String(retryAfter),
              'X-RateLimit-Limit':     String(max),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset':     String(Math.ceil(resetAt / 1000)),
            },
          }
        ),
      }
    }

    hits.push(now)
    store.set(key, hits)

    return { ok: true, remaining: max - hits.length }
  }
}

// ── Preconfigured limiters ────────────────────────────────────────────────────

/** Pay routes — 10 requests / minute per IP */
export const payLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'pay' })

/** Auth routes — 5 requests / minute per IP (brute-force protection) */
export const authLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'auth' })

/** Webhook ingestion — 60 per minute (Moolre can send bursts) */
export const webhookLimiter = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'webhook' })

/** General API routes — 30 requests / minute */
export const generalLimiter = rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'api' })
