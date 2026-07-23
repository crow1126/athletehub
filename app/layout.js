import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import AuthGuard from '@/components/AuthGuard'
import { Analytics } from "@vercel/analytics/next"
import ClickTracker from '@/components/ClickTracker'
import PWAProvider from '@/components/PWAProvider'
import InstallPWAButton from '@/components/InstallPWAButton'

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata = {
  title: 'ApexTrack',
  description: 'Complete football club management platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ApexTrack',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="antialiased">
        <PWAProvider />
        <AuthGuard>
          {children}
        </AuthGuard>
        <InstallPWAButton />
        <ClickTracker />
        <Analytics />
      </body>
    </html>
  )
}