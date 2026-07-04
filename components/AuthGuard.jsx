'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { canAccessModule } from '@/lib/subscription'

const PUBLIC_ROUTES  = ['/', '/login', '/auth/confirm', '/auth/reset-password', '/privacy', '/terms', '/security']
const BILLING_BYPASS = ['/billing', '/login', '/pay']

function pathToModule(path) {
  const map = {
    '/dashboard':   'dashboard',
    '/athletes':    'athletes',
    '/coaches':     'coaches',
    '/schedule':    'schedule',
    '/injuries':    'injuries',
    '/performance': 'performance',
    '/scouting':    'scouting',
    '/contracts':   'contracts',
    '/reports':     'reports',
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
    if (PUBLIC_ROUTES.includes(path)) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: profile, error } = await supabase
        .from('profiles').select('is_active, role, team_id').eq('id', session.user.id).single()

      if (error || !profile) { await supabase.auth.signOut(); router.replace('/login?reason=profile_error'); return }
      if (profile.is_active === false) { await supabase.auth.signOut(); router.replace('/login?reason=disabled'); return }

      // /pay routes: require admin, superadmin, or accountant, bypass subscription checks
      if (path === '/pay' || path.startsWith('/pay/')) {
        if (profile.role !== 'admin' && profile.role !== 'superadmin' && profile.role !== 'accountant') {
          router.replace('/dashboard?reason=insufficient_permissions')
          return
        }
        return // allow in
      }

      // If user is accountant but trying to access non-pay routes, redirect to pay subdomain.
      // No token passing needed — the shared .apextrackgh.com cookie is already present.
      if (profile.role === 'accountant') {
        const isPaySub = typeof window !== 'undefined' && window.location.hostname.startsWith('pay.')
        if (!isPaySub) {
          const host     = window.location.host.replace(/^www\./i, '')
          const protocol = window.location.protocol
          const isIP     = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname)
          const redirectUrl = isIP
            ? `${protocol}//${host}/pay`
            : `${protocol}//pay.${host}`
          window.location.href = redirectUrl
          return
        }
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
            if (profile.role === 'admin' || profile.role === 'superadmin') {
              router.replace('/billing?reason=expired')
            } else {
              await supabase.auth.signOut()
              router.replace('/login?reason=subscription_expired')
            }
            return
          }

          // Block modules not in the plan
          const module = pathToModule(path)
          if (module && !canAccessModule(sub.plan, module)) {
            router.replace(`/billing?reason=upgrade_required&module=${module}`)
            return
          }
        }
      }
    } catch (e) { console.error('AuthGuard error:', e) }
  }

  useEffect(() => {
    checkSession()
    interval.current = setInterval(checkSession, 30000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !PUBLIC_ROUTES.includes(path)) router.replace('/login?reason=signed_out')
    })
    return () => { clearInterval(interval.current); subscription?.unsubscribe() }
  }, [path])

  return children
}