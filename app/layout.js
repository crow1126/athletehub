import './globals.css'
import AuthGuard from '@/components/AuthGuard'

export const metadata = {
  title: 'AthleteHub — Ghana Football Operating System',
  description: 'Complete football management platform',
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