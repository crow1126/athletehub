// lib/rateLimit.js
// Distributed rate limiter with Upstash Redis / Vercel KV REST support
// and automatic in-memory sliding-window fallback.
//
// When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL +
// KV_REST_API_TOKEN) are set in the environment, counters are shared across all
// serverless instances via atomic Redis INCR + PEXPIRE pipelines.
// When not configured (e.g. local dev), falls back to an in-memory sliding window.
//
// Usage:
//   import { rateLimit } from '@/lib/rateLimit'
//   const limiter = rateLimit({ windowMs: 60_000, max: 10 })
//   const result  = await limiter(req)
//   if (!result.ok) return result.response

import { NextResponse } from 'next/server'

/**
 * Extract the best-available client IP from a Next.js App Router request.
 */
function getClientIp(req) {
  return (
    req?.headers?.get?.('x-real-ip') ||
    req?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

function buildRateLimitResponse(max, retryAfterSec, resetUnixSec) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After':           String(Math.max(1, retryAfterSec)),
        'X-RateLimit-Limit':     String(max),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset':     String(resetUnixSec),
      },
    }
  )
}

/**
 * Create a rate limiter function.
 * @param {object} options
 * @param {number} options.windowMs  - Rolling/fixed window size in milliseconds (default 60 000)
 * @param {number} options.max       - Max requests allowed per window per key (default 20)
 * @param {string} [options.keyPrefix] - Prefix to namespace multiple limiters
 * @returns {(req: Request, customKey?: string) => Promise<{ ok: boolean, remaining: number, response?: Response }>}
 */
export function rateLimit({ windowMs = 60_000, max = 20, keyPrefix = '' } = {}) {
  // In-memory fallback store: Map<key, Array<timestamp>>
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

  function checkInMemory(key) {
    const now = Date.now()
    const hits = (store.get(key) || []).filter(t => now - t < windowMs)

    if (hits.length >= max) {
      const resetAt = Math.min(...hits) + windowMs
      const retryAfter = Math.ceil((resetAt - now) / 1000)
      return {
        ok:        false,
        remaining: 0,
        response:  buildRateLimitResponse(max, retryAfter, Math.ceil(resetAt / 1000)),
      }
    }

    hits.push(now)
    store.set(key, hits)
    return { ok: true, remaining: max - hits.length }
  }

  async function checkRedis(redis, key) {
    const windowBucket = Math.floor(Date.now() / windowMs)
    const redisKey = `rl:${key}:${windowBucket}`
    const res = await fetch(`${redis.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redis.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, windowMs, 'NX'],
        ['PTTL', redisKey],
      ]),
    })

    if (!res.ok) {
      throw new Error(`Redis REST HTTP ${res.status}`)
    }

    const results = await res.json()
    const count = Number(results?.[0]?.result ?? 0)
    const pttl = Number(results?.[2]?.result ?? windowMs)
    const ttlMs = pttl > 0 ? pttl : windowMs

    if (count > max) {
      const retryAfter = Math.ceil(ttlMs / 1000)
      const resetAt = Math.ceil((Date.now() + ttlMs) / 1000)
      return {
        ok:        false,
        remaining: 0,
        response:  buildRateLimitResponse(max, retryAfter, resetAt),
      }
    }

    return { ok: true, remaining: Math.max(0, max - count) }
  }

  return async function limiter(req, customKey) {
    const ip  = getClientIp(req)
    const key = `${keyPrefix}:${customKey || ip}`
    const redis = getRedisConfig()

    if (redis) {
      try {
        return await checkRedis(redis, key)
      } catch (err) {
        console.warn('[rateLimit] Redis unavailable, falling back to memory:', err?.message)
      }
    }

    return checkInMemory(key)
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

/** User management (create / password reset) — 5 per 10 minutes per IP.
 *  Deters scripted credential enumeration and SMS-spam attacks. */
export const userMgmtLimiter = rateLimit({ windowMs: 10 * 60_000, max: 5, keyPrefix: 'usermgmt' })
