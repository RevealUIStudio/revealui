import { logger } from '@revealui/utils/logger';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
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
      `[admin Layout] draftMode() failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const primaryColor =
    process.env.REVEALUI_BRAND_PRIMARY_COLOR ?? process.env.REVEALUI_TENANT_BRAND;
  // Foreground color to use ON the brand color (e.g. for text in a brand-coloured panel).
  // Customers with light brand colours must override this with a dark value (e.g. '#0f172a')
  // to maintain WCAG contrast — there is no automatic contrast computation by design.
  const brandOnColor = process.env.REVEALUI_TENANT_BRAND_ON ?? 'white';
  // Optional tenant font family — must already be loaded as a stylesheet (see <link> tags below).
  // Built-in supported values today: 'Inter', 'Inter Tight'. Unset → falls back to Inter Tight.
  const tenantFont = process.env.REVEALUI_TENANT_FONT?.trim();
  // Fleet kits hide the RevealUI-branded Header/Footer by default. Customer-side
  // navigation/footer is out of scope for v1; future work can expose a tenant
  // header-block + footer-block via env or admin settings.
  const isFleetMode = process.env.REVEALUI_FLEET_MODE === 'true';

  // CSP nonce (set by the proxy in src/proxy.ts) — thread it to the inline theme
  // <Script> so it survives the nonce-based script-src (no 'unsafe-inline' in prod).
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  try {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>
          <InitTheme nonce={nonce} />
          <link href="/favicon.ico" rel="icon" sizes="32x32" />
          <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
          {/* RevealUI Theme Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap"
            rel="stylesheet"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
            rel="stylesheet"
          />
          {primaryColor || tenantFont ? (
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: inline <style> takes a string; both values are server-side env vars, no user-html injection surface
              dangerouslySetInnerHTML={{
                __html: [
                  ':root {',
                  primaryColor ? `--tenant-brand: ${primaryColor};` : '',
                  primaryColor ? '--primary: var(--tenant-brand);' : '',
                  primaryColor ? `--tenant-brand-on: ${brandOnColor};` : '',
                  tenantFont ? `--tenant-font: '${tenantFont}';` : '',
                  '}',
                  tenantFont
                    ? `body { font-family: var(--tenant-font), system-ui, -apple-system, sans-serif; }`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' '),
              }}
            />
          ) : null}
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

              {isFleetMode ? null : <Header />}
              <main>{children}</main>
              {isFleetMode ? null : <Footer />}
            </ErrorBoundary>
          </Providers>
          {/* Vercel Speed Insights for performance monitoring */}
          {process.env.NEXT_PUBLIC_VERCEL_ENV ? <SpeedInsights /> : null}
        </body>
      </html>
    );
  } catch (error: unknown) {
    logger.error(
      `[admin Layout] Render failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Fallback minimal layout so pages don't 500
    return (
      <html lang="en">
        <body>
          <main style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
            <p style={{ color: '#525252' }}>
              admin is initializing. Some features may be unavailable.
            </p>
            {children}
          </main>
        </body>
      </html>
    );
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const name = process.env.REVEALUI_BRAND_NAME ?? process.env.REVEALUI_TENANT_NAME ?? 'RevealUI';
  const adminLabel = `${name} admin`;
  return {
    title: {
      default: adminLabel,
      template: `%s | ${adminLabel}`,
    },
    metadataBase: new URL((process.env.NEXT_PUBLIC_SERVER_URL || 'https://revealui.com').trim()),
    openGraph: mergeOpenGraph(),
    twitter: {
      card: 'summary_large_image',
      creator: '@RevealUI',
    },
  };
}
