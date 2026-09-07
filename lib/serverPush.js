// lib/serverPush.js
// Server-side Web Push dispatcher for PWA (iPhone / Chrome / Edge) and Mobile Apps
import webpush from 'web-push'
import { createServiceClient } from '@/lib/serverAuth'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BKiVGNcwBQrFshg6dgzpFbAbhayE_2MXXb3x5C-oMGU61pxM0w2xPJiGER834qbOER0sN_KdSDt0nR35kS-b7vA'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '1k2DyqPYJrxg9i5hxxc5vs1eU7ih2mslNq5PjI9FiLI'
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@apextrackgh.com'

let vapidConfigured = false
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    vapidConfigured = true
  } catch (err) {
    console.warn('[serverPush] VAPID setup warning:', err.message)
  }
}

/**
 * Dispatch web push notification to a specific push subscription object
 */
export async function sendWebPushNotification(sub, payload) {
  if (!vapidConfigured) {
    return { success: false, reason: 'VAPID not configured' }
  }

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)

  try {
    const result = await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 86400, // 24 hours
    })
    return { success: true, statusCode: result.statusCode }
  } catch (err) {
    const isExpired = err.statusCode === 410 || err.statusCode === 404
    return {
      success: false,
      statusCode: err.statusCode,
      expired: isExpired,
      error: err.message,
    }
  }
}

/**
 * Send push notification to all subscribed devices for a specific team
 */
/**
 * Send push notification to all subscribed devices for a specific team, individualized per recipient
 */
export async function dispatchPushToTeam(teamId, { title, body, url = '/dashboard', tag = 'apextrack-alert' }) {
  if (!teamId) return { sent: 0, failed: 0 }

  const db = createServiceClient()
  try {
    // Select subscriptions with joined profiles for individual personalization
    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('*, profiles:user_id(full_name, role, team_id)')
      .or(`team_id.eq.${teamId},team_id.is.null`)

    const targetSubs = (subs || []).filter(s => s.team_id === teamId || s.profiles?.team_id === teamId)

    if (error || targetSubs.length === 0) {
      return { sent: 0, failed: 0, reason: error ? error.message : 'no subscribers' }
    }

    let sent = 0
    let failed = 0
    const expiredIds = []

    // Strip out internal admin SMS stats if present
    const cleanBody = (body || '').replace(/\s*\(\d+\s+(players?|members?|athletes?)\s+notified\s+via\s+SMS\)/gi, '').trim()

    await Promise.all(
      targetSubs.map(async (sub) => {
        if (sub.endpoint && sub.p256dh && sub.auth) {
          // Individualize notification per recipient
          const rawName = sub.profiles?.full_name?.trim()
          const firstName = rawName ? rawName.split(' ')[0] : ''
          const individualizedBody = (firstName && !cleanBody.toLowerCase().startsWith('hi '))
            ? `Hi ${firstName}, ${cleanBody}`
            : cleanBody

          const payload = {
            title: title || 'ApexTrack Alert',
            body: individualizedBody,
            url: url || '/dashboard',
            tag: `${tag}-${sub.user_id || 'dev'}`,
            timestamp: Date.now(),
          }

          const res = await sendWebPushNotification(sub, payload)
          if (res.success) {
            sent++
          } else {
            failed++
            if (res.expired && sub.id) {
              expiredIds.push(sub.id)
            }
          }
        }
      })
    )

    // Cleanup expired subscriptions
    if (expiredIds.length > 0) {
      await db.from('push_subscriptions').delete().in('id', expiredIds).catch(() => {})
    }

    return { sent, failed, total: subs.length }
  } catch (err) {
    console.warn('[dispatchPushToTeam] Error dispatching push:', err)
    return { sent: 0, failed: 0, error: err.message }
  }
}

/**
 * Send push notification to a specific user across their devices, individualized
 */
export async function dispatchPushToUser(userId, { title, body, url = '/dashboard', tag = 'apextrack-alert' }) {
  if (!userId) return { sent: 0, failed: 0 }

  const db = createServiceClient()
  try {
    const [{ data: subs, error }, { data: userProfile }] = await Promise.all([
      db.from('push_subscriptions').select('*').eq('user_id', userId),
      db.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    ])

    if (error || !subs || subs.length === 0) {
      return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0
    const expiredIds = []

    const cleanBody = (body || '').replace(/\s*\(\d+\s+(players?|members?|athletes?)\s+notified\s+via\s+SMS\)/gi, '').trim()
    const rawName = userProfile?.full_name?.trim()
    const firstName = rawName ? rawName.split(' ')[0] : ''
    const individualizedBody = (firstName && !cleanBody.toLowerCase().startsWith('hi '))
      ? `Hi ${firstName}, ${cleanBody}`
      : cleanBody

    const payload = {
      title: title || 'ApexTrack Alert',
      body: individualizedBody,
      url: url || '/dashboard',
      tag: `${tag}-${userId}`,
      timestamp: Date.now(),
    }

    await Promise.all(
      subs.map(async (sub) => {
        if (sub.endpoint && sub.p256dh && sub.auth) {
          const res = await sendWebPushNotification(sub, payload)
          if (res.success) {
            sent++
          } else {
            failed++
            if (res.expired && sub.id) {
              expiredIds.push(sub.id)
            }
          }
        }
      })
    )

    if (expiredIds.length > 0) {
      await db.from('push_subscriptions').delete().in('id', expiredIds).catch(() => {})
    }

    return { sent, failed, total: subs.length }
  } catch (err) {
    console.warn('[dispatchPushToUser] Error dispatching push:', err)
    return { sent: 0, failed: 0, error: err.message }
  }
}
