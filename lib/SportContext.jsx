'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getSportConfig } from '@/lib/sportsConfig'
import { getTenantProfile } from '@/lib/tenant'

const SportContext = createContext({
  sportId: 'football',
  sportConfig: getSportConfig('football'),
  isFootball: true,
  isBasketball: false,
  loading: true,
})

export function SportProvider({ children }) {
  const [sportId, setSportId] = useState('football')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSport() {
      try {
        const { profile } = await getTenantProfile('team_id, teams(sport_type)')
        const rawSport = profile?.teams?.sport_type || 'football'
        setSportId(rawSport)
      } catch (e) {
        console.error('Error loading sport context:', e)
      } finally {
        setLoading(false)
      }
    }
    loadSport()
  }, [])

  const config = getSportConfig(sportId)

  const value = {
    sportId: config.id,
    sportConfig: config,
    isFootball: config.id === 'football',
    isBasketball: config.id === 'basketball',
    loading,
  }

  return (
    <SportContext.Provider value={value}>
      {children}
    </SportContext.Provider>
  )
}

export function useSport() {
  return useContext(SportContext)
}
