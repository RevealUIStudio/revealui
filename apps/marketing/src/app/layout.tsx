import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NavBar } from '@/components/NavBar';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadataBase = new URL('https://revealui.com');

export const metadata: Metadata = {
  title: 'RevealUI — Business OS Software (BOSS)',
  description:
    'Business OS Software (BOSS). Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.',
  keywords: [
    'open source',
    'business OS',
    'BOSS',
    'SaaS',
    'auth',
    'billing',
    'AI agents',
    'Stripe',
    'TypeScript',
  ],
  authors: [{ name: 'RevealUI Studio' }],
  openGraph: {
    title: 'RevealUI — Business OS Software (BOSS). Build your business, not your boilerplate.',
    description:
      'The UI for the future has yet to Reveal itself. Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.',
    type: 'website',
    images: [
      {
        url: '/api/og?title=RevealUI&description=Business OS Software (BOSS). Build your business, not your boilerplate.',
        width: 1200,
        height: 630,
        alt: 'RevealUI — Business OS Software (BOSS)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RevealUI — Business OS Software (BOSS). Build your business, not your boilerplate.',
    description:
      'The UI for the future has yet to Reveal itself. Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.',
    images: [
      '/api/og?title=RevealUI&description=Business OS Software (BOSS). Build your business, not your boilerplate.',
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
