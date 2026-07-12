'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ClickTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Avoid logging local dev tracking unless we are debugging
    // if (window.location.hostname === 'localhost') return

    const url = window.location.href
    const referrer = document.referrer || ''

    fetch('/api/track-click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        referrer,
      }),
    }).catch((err) => {
      console.error('Click tracking error:', err)
    })
  }, [pathname])

  return null
}
