// lib/serverPush.js
// Server-side Web Push dispatcher for PWA (iPhone / Chrome / Edge) and Mobile Apps
import webpush from 'web-push'
import { createServiceClient } from '@/lib/serverAuth'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
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
export async function dispatchPushToTeam(teamId, { title, body, url = '/dashboard', tag = 'apextrack-alert' }) {
  if (!teamId) return { sent: 0, failed: 0 }

  const db = createServiceClient()
  try {
    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('*')
      .eq('team_id', teamId)

    if (error || !subs || subs.length === 0) {
      return { sent: 0, failed: 0, reason: error ? error.message : 'no subscribers' }
    }

    let sent = 0
    let failed = 0
    const expiredIds = []

    const payload = {
      title: title || 'ApexTrack Alert',
      body: body || '',
      url: url || '/dashboard',
      tag,
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
 * Send push notification to a specific user across their devices
 */
export async function dispatchPushToUser(userId, { title, body, url = '/dashboard', tag = 'apextrack-alert' }) {
  if (!userId) return { sent: 0, failed: 0 }

  const db = createServiceClient()
  try {
    const { data: subs, error } = await db
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error || !subs || subs.length === 0) {
      return { sent: 0, failed: 0 }
    }

    let sent = 0
    let failed = 0
    const expiredIds = []

    const payload = {
      title: title || 'ApexTrack Alert',
      body: body || '',
      url: url || '/dashboard',
      tag,
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
