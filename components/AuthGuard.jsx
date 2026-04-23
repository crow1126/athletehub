'use client'
import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// These routes don't need authentication
const PUBLIC_ROUTES = ['/login']

export default function AuthGuard({ children }) {
  const router   = useRouter()
  const path     = usePathname()
  const interval = useRef(null)

  async function checkSession() {
    // Skip check on public routes
    if (PUBLIC_ROUTES.includes(path)) return

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/login')
        return
      }

      // Check is_active on the profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', session.user.id)
        .single()

      if (error || !profile) {
        await supabase.auth.signOut()
        router.replace('/login?reason=profile_error')
        return
      }

      if (profile.is_active === false) {
        // Admin has disabled this account — sign out immediately
        await supabase.auth.signOut()
        router.replace('/login?reason=disabled')
        return
      }
    } catch (e) {
      console.error('AuthGuard check error:', e)
    }
  }

  useEffect(() => {
    // Check immediately on mount / route change
    checkSession()

    // Then poll every 30 seconds so disabled accounts are caught quickly
    interval.current = setInterval(checkSession, 30000)

    // Also listen for auth state changes (e.g. global signout from admin)
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