'use client'
import { createContext, useContext } from 'react'
import { getSportConfig } from '@/lib/sportsConfig'

const footballConfig = getSportConfig('football')

const SportContext = createContext({
  sportId: 'football',
  sportConfig: footballConfig,
  isFootball: true,
  isBasketball: false,
  loading: false,
})

export function SportProvider({ children }) {
  const value = {
    sportId: 'football',
    sportConfig: footballConfig,
    isFootball: true,
    isBasketball: false,
    loading: false,
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
