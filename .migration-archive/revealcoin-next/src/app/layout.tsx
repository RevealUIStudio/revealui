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
  metadataBase: new URL('https://revealcoin.revealui.com'),
  title: 'RevealCoin (RVC)  -  Utility, Governance & Reward Token',
  description:
    'The native token of the RevealUI ecosystem. 58.9B fixed supply on Solana Token-2022. Utility payments, governance voting, and ecosystem rewards.',
  keywords: [
    'RevealCoin',
    'RVC',
    'Solana',
    'Token-2022',
    'utility token',
    'governance',
    'RevealUI',
    'cryptocurrency',
  ],
  authors: [{ name: 'RevealUI Studio' }],
  openGraph: {
    title: 'RevealCoin (RVC)  -  The Native Token of RevealUI',
    description:
      '58.9B fixed supply. Utility payments, governance voting, and ecosystem rewards. Built on Solana Token-2022.',
    type: 'website',
    images: [
      {
        url: 'https://arweave.net/p6DmWVkFTfo9AcENidr7gmzgQSq_LCbZ-wrbM6hx8gY',
        width: 512,
        height: 512,
        alt: 'RevealCoin Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'RevealCoin (RVC)  -  The Native Token of RevealUI',
    description: '58.9B fixed supply. Utility payments, governance voting, and ecosystem rewards.',
    images: ['https://arweave.net/p6DmWVkFTfo9AcENidr7gmzgQSq_LCbZ-wrbM6hx8gY'],
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
