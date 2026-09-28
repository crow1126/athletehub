export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://apextrackgh.com'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/superadmin/',
        '/billing/',
        '/settings/',
        '/player-hub/',
        '/scouting/',
        '/contracts/',
        '/transfers/',
        '/injuries/',
        '/reports/',
        '/schedule/',
        '/coaches/',
        '/athletes/',
        '/performance/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
