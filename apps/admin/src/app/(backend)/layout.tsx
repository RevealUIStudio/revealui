import { RootLayout } from '@revealui/core/admin';
import { cookies, headers } from 'next/headers';
import Script from 'next/script';
/* RevealUI Admin Layout - Local implementation */
import type React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AdminSidebarLayout } from '@/lib/components/AdminSidebarLayout';
import { LicenseProvider } from '@/lib/providers/LicenseProvider';
import config from '../../../revealui.config';

import { importMap } from './importMap';
import '@revealui/presentation/tokens.css';
import './custom.css';

type Args = {
  children: React.ReactNode;
};

// Force dynamic rendering so Next.js reads the per-request CSP nonce (set by
// src/proxy.ts) and stamps it on its own inline bootstrap/RSC scripts. Without
// this the shell is statically pre-rendered at build time with zero nonces, and
// the CSP blocks every hydration script → spinner forever on (backend)/* pages.
export const dynamic = 'force-dynamic';

// White-label: read tenant identity in the server component and prop-drill
// to the client sidebar (env vars in `'use client'` files get inlined at
// framework build time, missing the kit's stamped value at runtime).
// `||` not `??`: Compose `${VAR:-}` delivers unset vars as empty strings.
const siteName = process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
const isFleetMode = process.env.REVEALUI_FLEET_MODE === 'true';
const ADMIN_ROLES = new Set(['owner', 'admin', 'super-admin']);

export default async function Layout({ children }: Args) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const role = (await cookies()).get('revealui-role')?.value ?? '';
  const isAdmin = ADMIN_ROLES.has(role);
  return (
    <RootLayout config={config} importMap={importMap}>
      {nonce ? (
        <Script
          id="revealui-admin-nonce"
          nonce={nonce}
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: inline nonce carrier; fixed literal string, no user content
          dangerouslySetInnerHTML={{ __html: 'window.__RVUI__=1;' }}
        />
      ) : null}
      <LicenseProvider>
        <ErrorBoundary>
          <AdminSidebarLayout siteName={siteName} isFleetMode={isFleetMode} isAdmin={isAdmin}>
            {children}
          </AdminSidebarLayout>
        </ErrorBoundary>
      </LicenseProvider>
    </RootLayout>
  );
}
