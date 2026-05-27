'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function hasAuthParams(url) {
  return (
    url.searchParams.has('code') ||
    url.searchParams.has('token_hash') ||
    url.hash.includes('access_token') ||
    url.hash.includes('refresh_token')
  )
}

function authRedirectTarget(url) {
  if (url.searchParams.has('code') || url.searchParams.has('token_hash')) {
    return `/auth/callback${url.search}`
  }
  return `/auth/confirm${url.search}${url.hash}`
}

export default function HomeRedirect() {
  const router = useRouter()

  useEffect(() => {
    const url = new URL(window.location.href)

    if (hasAuthParams(url)) {
      window.location.replace(authRedirectTarget(url))
      return
    }

    router.replace('/login')
  }, [router])

  return null
}
