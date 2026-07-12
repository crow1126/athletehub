import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import AuthGuard from '@/components/AuthGuard'
import { Analytics } from "@vercel/analytics/next"
import ClickTracker from '@/components/ClickTracker'

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata = {
  title: 'Apex Track',
  description: 'Complete football management platform',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="antialiased">
        <AuthGuard>
          {children}
        </AuthGuard>
        <ClickTracker />
        <Analytics />
      </body>
    </html>
  )
}