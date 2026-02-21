import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'RevealUI - White-Label CMS for Digital Agencies',
  description:
    'Build client websites faster with source code access, AI-powered content management, and enterprise-grade features. Deploy white-label solutions that scale.',
  keywords: ['CMS', 'white-label', 'digital agency', 'AI', 'content management', 'multi-tenant'],
  authors: [{ name: 'RevealUI Team' }],
  openGraph: {
    title: 'RevealUI - White-Label CMS for Digital Agencies',
    description:
      'Deploy professional, scalable CMS solutions with full source code access and AI features.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
