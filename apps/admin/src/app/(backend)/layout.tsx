import { RootLayout } from '@revealui/core/admin';
/* RevealUI Admin Layout - Local implementation */
import type React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LicenseProvider } from '@/lib/providers/LicenseProvider';
import config from '../../../revealui.config';

import { importMap } from './admin/importMap';
import '@revealui/presentation/tokens.css';
import './custom.css';

type Args = {
  children: React.ReactNode;
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap}>
    <LicenseProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </LicenseProvider>
  </RootLayout>
);

export default Layout;
