import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RevealUI App',
  description: 'Built with RevealUI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
