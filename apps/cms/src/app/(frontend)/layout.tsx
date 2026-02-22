import type React from 'react'

// TEMPORARY: Stripped layout to debug 500 on Vercel
// All imports removed to isolate module-level crash
// TODO: Re-add imports one by one after confirming bare layout works

export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
