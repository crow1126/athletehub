import './globals.css'
import AuthGuard from '@/components/AuthGuard'
import { Analytics } from "@vercel/analytics/next"

export const metadata = {
  title: 'Apex Track',
  description: 'Complete football management platform',
  icons: {
    icon: '/apex-track-logo.svg',
    shortcut: '/apex-track-logo.svg',
    apple: '/apex-track-logo.svg',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}