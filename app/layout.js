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
  metadataBase: new URL('https://www.apextrackgh.com'),
  alternates: {
    canonical: '/',
  },
  title: {
    default: 'ApexTrack GH - Complete Football Club Management Platform',
    template: '%s | ApexTrack GH',
  },
  description: 'ApexTrack GH is the premier football club management and scouting platform in Ghana and Africa. Track athlete performance, transfers, match schedules, contracts, and player development.',
  keywords: [
    'apextrack',
    'apextrackgh',
    'ApexTrack GH',
    'ApexTrack Ghana',
    'football club management',
    'Ghana football scouting',
    'soccer scouting platform',
    'athlete tracking system',
    'Ghana Premier League analytics',
  ],
  authors: [{ name: 'ApexTrack GH' }],
  creator: 'ApexTrack GH',
  publisher: 'ApexTrack GH',
  openGraph: {
    title: 'ApexTrack GH - Complete Football Club Management Platform',
    description: 'Premier football club management, scouting, and athlete tracking platform for Ghana and Africa.',
    url: 'https://www.apextrackgh.com',
    siteName: 'ApexTrack GH',
    locale: 'en_GH',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ApexTrack GH',
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
}

export const viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
              var isCapacitor = (typeof window !== 'undefined' && (window.Capacitor?.isNativePlatform?.() || window.Capacitor != null)) || (ua.includes('Android') && (ua.includes('wv') || ua.includes('Version/4.0') || ua.includes('Capacitor')));
              var isElectron = (typeof window !== 'undefined' && window.electronAPI?.isElectron) || ua.includes('Electron') || ua.includes('ApexTrackDesktop');
              var isNative = isElectron || isCapacitor;
              var isStandalone = window.navigator?.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || isNative;
              if(isStandalone){document.documentElement.classList.add('is-standalone');}
              if(isElectron){document.documentElement.classList.add('is-electron');}
              if(isNative){
                document.documentElement.classList.add('is-native-app');
                document.documentElement.classList.add('is-electron');
              }
            }catch(e){}})()`,
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