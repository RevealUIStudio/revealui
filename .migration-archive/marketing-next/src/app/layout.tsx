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

// SEO/social metadata mirrors the home-page positioning. When the H1 in
// apps/marketing/src/components/landing/Hero.tsx changes, these strings
// need to change too — keep them aligned.
const PAGE_TITLE = 'RevealUI | Build a business your agents can run.';
const PAGE_DESCRIPTION =
  'Auth, billing, content, and AI primitives wired into one runtime — so the same APIs your users hit, your agents hit too.';
const OG_IMAGE_URL = `/api/og?title=${encodeURIComponent('RevealUI')}&description=${encodeURIComponent('Build a business your agents can run.')}`;

export const metadata: Metadata = {
  metadataBase: new URL('https://revealui.com'),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    'open source',
    'agent-native',
    'AI agents',
    'business runtime',
    'auth',
    'billing',
    'CMS',
    'admin dashboard',
    'MCP',
    'Stripe',
    'Next.js',
    'self-hostable',
    'RevealUI',
    'RevVault',
    'RevKit',
    'RevealCoin',
  ],
  authors: [{ name: 'RevealUI Studio' }],
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: 'website',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: PAGE_TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE_URL],
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
