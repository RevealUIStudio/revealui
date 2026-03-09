import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NavBar } from '@/components/NavBar'
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
  title: 'RevealUI — Open-Source Business Infrastructure',
  description:
    'Users, content, products, payments, and AI — pre-wired and ready to deploy. Open-source business infrastructure for software companies.',
  keywords: [
    'open source',
    'business infrastructure',
    'SaaS',
    'auth',
    'billing',
    'AI agents',
    'Stripe',
    'TypeScript',
  ],
  authors: [{ name: 'RevealUI Studio' }],
  openGraph: {
    title: 'RevealUI — Build your business, not your boilerplate.',
    description:
      'Users, content, products, payments, and AI — pre-wired and ready to deploy. Open-source business infrastructure for software companies.',
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
        <NavBar />
        {children}
      </body>
    </html>
  )
}
