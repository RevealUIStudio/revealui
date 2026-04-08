import { logger } from '@revealui/utils/logger';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata } from 'next';
import { draftMode } from 'next/headers';
import type React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdminBar } from '@/lib/components/AdminBar';
import { LivePreviewListener } from '@/lib/components/LivePreviewListener';
import { Footer } from '@/lib/globals/Footer/Component';
import { Header } from '@/lib/globals/Header/Component';
import { Providers } from '@/lib/providers';
import { InitTheme } from '@/lib/providers/Theme/InitTheme';
import { mergeOpenGraph } from '@/lib/utilities/mergeOpenGraph';
import '@revealui/presentation/tokens.css';
import './styles.css';

// Force dynamic rendering to prevent global-error prerendering issues
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let isEnabled = false;
  try {
    const draft = await draftMode();
    isEnabled = draft.isEnabled;
  } catch (error: unknown) {
    logger.error(
      `[CMS Layout] draftMode() failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  function cn(...classNames: (string | undefined)[]): string {
    return classNames.filter(Boolean).join(' ');
  }

  try {
    return (
      <html
        className={cn(GeistSans.variable, GeistMono.variable)}
        lang="en"
        suppressHydrationWarning
      >
        <head>
          <InitTheme />
          <link href="/favicon.ico" rel="icon" sizes="32x32" />
          <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
          {/* RevealUI Theme Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wdth,wght@0,112.5,200..900;1,112.5,200..900&display=swap"
            rel="stylesheet"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <Providers>
            <ErrorBoundary>
              <AdminBar
                adminBarProps={{
                  preview: isEnabled,
                }}
              />
              <LivePreviewListener />

              <Header />
              <main>{children}</main>
              <Footer />
            </ErrorBoundary>
          </Providers>
          {/* Vercel Speed Insights for performance monitoring */}
          {process.env.NEXT_PUBLIC_VERCEL_ENV ? <SpeedInsights /> : null}
        </body>
      </html>
    );
  } catch (error: unknown) {
    logger.error(
      `[CMS Layout] Render failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Fallback minimal layout so pages don't 500
    return (
      <html lang="en">
        <body>
          <main style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
            <p style={{ color: '#525252' }}>
              CMS is initializing. Some features may be unavailable.
            </p>
            {children}
          </main>
        </body>
      </html>
    );
  }
}

export const metadata: Metadata = {
  title: {
    default: 'RevealUI CMS',
    template: '%s | RevealUI CMS',
  },
  metadataBase: new URL((process.env.NEXT_PUBLIC_SERVER_URL || 'https://revealui.com').trim()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@RevealUI',
  },
};
