'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PUBLIC_ROUTES  = ['/login']
// Billing page always accessible so admin can resubscribe
const BILLING_BYPASS = ['/billing', '/login']

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
        .from('profiles')
        .select('is_active, role, team_id')
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        await supabase.auth.signOut()
        router.replace('/login?reason=profile_error')
        return
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut()
        router.replace('/login?reason=disabled')
        return
      }

      // ── Subscription check (skip for billing page so admin can fix it) ──
      if (!BILLING_BYPASS.includes(path) && profile.team_id) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, plan, current_period_end, trial_ends_at')
          .eq('team_id', profile.team_id)
          .single()

        if (sub) {
          const isExpired =
            sub.status === 'cancelled' ||
            sub.status === 'expired'   ||
            (sub.plan === 'trial' && new Date(sub.trial_ends_at) < new Date()) ||
            (sub.plan !== 'trial' && new Date(sub.current_period_end) < new Date())

          // Only admins get redirected to billing — others see a blocked message
          if (isExpired) {
            if (profile.role === 'admin' || profile.role === 'superadmin') {
              router.replace('/billing?reason=expired')
            } else {
              router.replace('/login?reason=subscription_expired')
            }
            return
          }
        }
      }

    } catch (e) {
      console.error('AuthGuard check error:', e)
    }
  }

  useEffect(() => {
    checkSession()
    interval.current = setInterval(checkSession, 30000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !PUBLIC_ROUTES.includes(path)) {
        router.replace('/login?reason=signed_out')
      }
    })

    return () => {
      clearInterval(interval.current)
      subscription?.unsubscribe()
    }
  }, [path])

  return children
}