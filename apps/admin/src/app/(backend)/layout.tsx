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

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap}>
    <LicenseProvider>
      <ErrorBoundary>
        <AdminSidebarLayout>{children}</AdminSidebarLayout>
      </ErrorBoundary>
    </LicenseProvider>
  </RootLayout>
);

export default Layout;
