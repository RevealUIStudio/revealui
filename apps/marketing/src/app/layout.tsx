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

export const metadata: Metadata = {
  metadataBase: new URL('https://revealui.com'),
  title: 'RevealUI — The Agentic Business Runtime',
  description:
    'The agentic business runtime. Users, content, products, payments, and AI — pre-wired, open source, and part of a four-project ecosystem for building, securing, and monetizing agentic software.',
  keywords: [
    'open source',
    'agentic business runtime',
    'SaaS',
    'auth',
    'billing',
    'AI agents',
    'Stripe',
    'TypeScript',
    'RevVault',
    'RevKit',
    'RevealCoin',
    'ecosystem',
    'secret vault',
  ],
  authors: [{ name: 'RevealUI Studio' }],
  openGraph: {
    title: 'RevealUI — The Agentic Business Runtime. Build your business, not your boilerplate.',
    description:
      'The agentic business runtime. Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.',
    type: 'website',
    images: [
      {
        url: '/api/og?title=RevealUI&description=The agentic business runtime. Build your business, not your boilerplate.',
        width: 1200,
        height: 630,
        alt: 'RevealUI — The Agentic Business Runtime',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RevealUI — The Agentic Business Runtime. Build your business, not your boilerplate.',
    description:
      'The agentic business runtime. Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.',
    images: [
      '/api/og?title=RevealUI&description=The agentic business runtime. Build your business, not your boilerplate.',
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
