'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { canAccess } from '@/lib/auth'
import { canAccessModule } from '@/lib/subscription'

const PUBLIC_ROUTES  = ['/', '/login', '/auth/confirm', '/auth/reset-password', '/forgot-password', '/privacy', '/terms', '/security', '/download', '/download/android']
const BILLING_BYPASS = ['/billing', '/login', '/pay']

function pathToModule(path) {
  const map = {
    '/superadmin':  'superadmin',
    '/dashboard':   'dashboard',
    '/notices':     'notices',
    '/athletes':    'athletes',
    '/coaches':     'coaches',
    '/schedule':    'schedule',
    '/injuries':    'injuries',
    '/performance': 'performance',
    '/scouting':    'scouting',
    '/contracts':   'contracts',
    '/reports':     'reports',
    '/transfers':   'transfers',
    '/settings':    'settings',
    '/billing':     'billing',
    '/player-hub':  'player-hub',
  }
  const key = Object.keys(map).find(k => path === k || path.startsWith(k + '/'))
  return key ? map[key] : null
}

export default function AuthGuard({ children }) {
  const router   = useRouter()
  const path     = usePathname()
  const interval = useRef(null)

  async function checkSession() {
    if (!path) return
    const pathWithoutQuery = path.split('?')[0]
    const cleanPath = pathWithoutQuery.length > 1 ? pathWithoutQuery.replace(/\/$/, '') : pathWithoutQuery
    if (PUBLIC_ROUTES.includes(cleanPath) || cleanPath.startsWith('/download')) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      let profile = null
      let error = null
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await supabase
          .from('profiles').select('is_active, role, team_id, username, email').eq('id', session.user.id).single()
        profile = res.data
        error = res.error
        if (profile) break
        await new Promise(r => setTimeout(r, 600))
      }

      if (!profile) { 
        console.error('AuthGuard profile fetch error:', error)
        if (error?.code === 'PGRST116') {
          // Profile row not found
          await supabase.auth.signOut()
          router.replace('/login?reason=profile_error')
          return
        }
        // Temporary lookup failure — do not force sign out
        return
      }
      if (profile.is_active === false) { await supabase.auth.signOut(); router.replace('/login?reason=disabled'); return }

      // Resolve specialized staff role (analyst, scout, physio) if stored as coach
      if (profile.role === 'coach') {
        try {
          const userEmail = (session.user.email || profile.email || '').toLowerCase()
          const { data: coachRec } = await supabase
            .from('coaches')
            .select('staff_type')
            .or(`user_id.eq.${session.user.id}${userEmail ? `,email.eq.${userEmail}` : ''}`)
            .maybeSingle()
          if (coachRec?.staff_type) {
            const st = coachRec.staff_type.toLowerCase()
            if (['analyst', 'scout', 'physio'].includes(st)) profile.role = st
          }
          if (profile.role === 'coach') {
            const filters = []
            if (userEmail) filters.push(`email.eq.${userEmail}`)
            if (profile.username) filters.push(`username.eq.${profile.username}`)
            if (filters.length > 0) {
              const { data: slRec } = await supabase
                .from('staff_logins')
                .select('role')
                .or(filters.join(','))
                .maybeSingle()
              if (slRec?.role) {
                const sr = slRec.role.toLowerCase()
                if (['analyst', 'scout', 'physio'].includes(sr)) profile.role = sr
              }
            }
          }
        } catch {
          // preserve coach role
        }
      }

      // ApexPay: Restricted to all roles (Coming Soon)
      if (path === '/pay' || path.startsWith('/pay/')) {
        const dest = profile.role === 'player' ? '/player-hub' : (profile.role === 'superadmin' ? '/superadmin' : '/dashboard')
        router.replace(dest)
        return
      }

      // Player role protection: strictly redirect players trying to access staff/admin routes to /player-hub
      if (profile.role === 'player') {
        const allowedPlayerPrefixes = ['/player-hub', '/notices', '/settings']
        const isPlayerAllowed = allowedPlayerPrefixes.some(p => path === p || path.startsWith(p + '/'))
        if (!isPlayerAllowed) {
          router.replace('/player-hub')
          return
        }
      }

      // Superadmin is platform-level and completely subscription-free across all modules and routes
      if (profile.role === 'superadmin') {
        return
      }

      // Role permission check: redirect if user role does not have access to this module
      const currentMod = pathToModule(path)
      if (currentMod && !canAccess(profile.role, currentMod)) {
        const fallback = profile.role === 'player' ? '/player-hub' : '/dashboard'
        router.replace(fallback)
        return
      }

      if (!BILLING_BYPASS.some(b => path === b || path.startsWith(b + '/')) && profile.team_id) {
        const { data: sub } = await supabase
          .from('subscriptions').select('status,plan,current_period_end,trial_ends_at')
          .eq('team_id', profile.team_id).single()

        if (sub) {
          const isExpired =
            sub.status === 'cancelled' || sub.status === 'expired' ||
            (sub.plan === 'trial' && new Date(sub.trial_ends_at) < new Date()) ||
            (sub.plan !== 'trial' && new Date(sub.current_period_end) < new Date())

          if (isExpired) {
            if (profile.role === 'admin') {
              // Admins can see billing and renew — just redirect, keep them logged in
              router.replace('/billing?reason=expired')
            } else {
              // Non-admin staff (coaches, physios, etc.) don't have billing access
              // Sign them out cleanly so they get a clear "contact your admin" message
              await supabase.auth.signOut()
              router.replace('/login?reason=subscription_expired')
            }
            return
          }

          // Block modules not in the plan
          const mod = pathToModule(path)
          if (mod && !canAccessModule(sub.plan, mod)) {
            router.replace(`/billing?reason=upgrade_required&module=${mod}`)
            return
          }
        }
      }
    } catch (e) { console.error('AuthGuard error:', e) }
  }

  useEffect(() => {
    checkSession()
    // Poll every 5 minutes instead of 30s — reduces false sign-outs on slow networks
    interval.current = setInterval(checkSession, 5 * 60 * 1000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      const clean = path ? (path.split('?')[0].length > 1 ? path.split('?')[0].replace(/\/$/, '') : path.split('?')[0]) : '/'
      if (event === 'SIGNED_OUT' && !PUBLIC_ROUTES.includes(clean)) router.replace('/login?reason=signed_out')
    })
    return () => { clearInterval(interval.current); subscription?.unsubscribe() }
  }, [path])

  return children
}