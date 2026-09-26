import { readTenantBrandStyle, renderTenantBrandStyle } from '@revealui/config';
import { logger } from '@revealui/utils/logger';
import type { Metadata } from 'next';
import { draftMode, headers } from 'next/headers';
import type React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { isAuthPath } from '@/lib/auth/auth-paths';
import { mergeOpenGraph } from '@/lib/cms/mergeOpenGraph';
import { AdminBar } from '@/lib/components/AdminBar';
import { LivePreviewListener } from '@/lib/components/LivePreviewListener';
import { Footer } from '@/lib/globals/Footer/Component';
import { Header } from '@/lib/globals/Header/Component';
import { Providers } from '@/lib/providers';
import { InitTheme } from '@/lib/providers/Theme/InitTheme';
import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
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

  // Brand CSS comes from Zod-validated config (hex, boolean/on, font allowlist).
  // Invalid tokens are omitted. Nothing from raw env is interpolated below.
  const tenantBrandCss = renderTenantBrandStyle(
    readTenantBrandStyle({
      REVEALUI_BRAND_PRIMARY_COLOR: process.env.REVEALUI_BRAND_PRIMARY_COLOR,
      REVEALUI_TENANT_BRAND: process.env.REVEALUI_TENANT_BRAND,
      REVEALUI_TENANT_BRAND_ON: process.env.REVEALUI_TENANT_BRAND_ON,
      REVEALUI_TENANT_FONT: process.env.REVEALUI_TENANT_FONT,
    }),
  );
  // Fleet kits hide the RevealUI-branded Header/Footer by default. Customer-side
  // navigation/footer is out of scope for v1; future work can expose a tenant
  // header-block + footer-block via env or admin settings.
  const isFleetMode = process.env.REVEALUI_FLEET_MODE === 'true';
  const pathname = (await headers()).get('x-revealui-pathname') ?? '';
  const hideSiteChrome = isFleetMode || isAuthPath(pathname);

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
          <link href="/favicon.png" rel="icon" type="image/png" />
          <link href="/favicon-32.png" rel="icon" type="image/png" sizes="32x32" />
          <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
          {/* RevealUI Theme Fonts are self-hosted via @fontsource-variable/*
              (imported at the top of this layout); no third-party font hosts. GAP-324. */}
          {tenantBrandCss ? (
            <style
              // biome-ignore lint/security/noDangerouslySetInnerHtml: string is renderTenantBrandStyle() — Zod hex, boolean/on, and the font allowlist only
              dangerouslySetInnerHTML={{ __html: tenantBrandCss }}
            />
          ) : null}
        </head>
        <body>
          <Providers isFleetMode={isFleetMode}>
            <ErrorBoundary>
              <AdminBar
                adminBarProps={{
                  preview: isEnabled,
                }}
              />
              <LivePreviewListener />

              {hideSiteChrome ? null : <Header />}
              {hideSiteChrome ? children : <main>{children}</main>}
              {hideSiteChrome ? null : <Footer />}
            </ErrorBoundary>
          </Providers>
          {/* Speed Insights mounts inside CookieConsentRoot after analytics consent. */}
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
  // `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
  // empty strings, which must fall through to the next candidate.
  const name = process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
  const adminLabel = `${name} admin`;
  // White-label: REVEALUI_BRAND_TWITTER lets a kit set its own Twitter/X
  // handle (e.g. '@AcmeCorp'); when unset, fall back to the canonical
  // RevealUI handle ONLY if no brand override is in effect. A branded kit
  // with no Twitter handle gets no `creator` meta — better than leaking
  // the framework's account on customer share cards.
  const brandOverridden =
    Boolean(process.env.REVEALUI_BRAND_NAME) || Boolean(process.env.REVEALUI_TENANT_NAME);
  const twitterCreator =
    process.env.REVEALUI_BRAND_TWITTER || (brandOverridden ? undefined : '@RevealUI');
  return {
    title: {
      default: adminLabel,
      template: `%s | ${adminLabel}`,
    },
    metadataBase: new URL((process.env.NEXT_PUBLIC_SERVER_URL || 'https://revealui.com').trim()),
    openGraph: mergeOpenGraph(),
    twitter: {
      card: 'summary_large_image',
      ...(twitterCreator ? { creator: twitterCreator } : {}),
    },
  };
}
