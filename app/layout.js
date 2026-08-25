import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import AuthGuard from '@/components/AuthGuard'
import { Analytics } from "@vercel/analytics/next"
import ClickTracker from '@/components/ClickTracker'
import PWAProvider from '@/components/PWAProvider'
import CapacitorProvider from '@/components/CapacitorProvider'
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isStandalone=window.navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||(typeof navigator!=='undefined'&&(navigator.userAgent.includes('Electron')||navigator.userAgent.includes('ApexTrackDesktop')))||window.electronAPI?.isElectron;if(isStandalone){document.documentElement.classList.add('is-standalone');}if(typeof navigator!=='undefined'&&(navigator.userAgent.includes('Electron')||navigator.userAgent.includes('ApexTrackDesktop')||window.electronAPI?.isElectron)){document.documentElement.classList.add('is-electron');}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <PWAProvider />
        <CapacitorProvider />
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