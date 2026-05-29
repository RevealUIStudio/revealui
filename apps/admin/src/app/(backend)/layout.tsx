import { RootLayout } from '@revealui/core/admin';
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

// White-label: read tenant identity in the server component and prop-drill
// to the client sidebar (env vars in `'use client'` files get inlined at
// framework build time, missing the kit's stamped value at runtime).
const siteName = process.env.REVEALUI_BRAND_NAME ?? process.env.REVEALUI_TENANT_NAME ?? 'RevealUI';

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap}>
    <LicenseProvider>
      <ErrorBoundary>
        <AdminSidebarLayout siteName={siteName}>{children}</AdminSidebarLayout>
      </ErrorBoundary>
    </LicenseProvider>
  </RootLayout>
);

export default Layout;
