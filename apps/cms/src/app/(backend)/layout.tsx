import { RootLayout } from '@revealui/core/admin';
/* RevealUI Admin Layout - Local implementation */
import type React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import config from '../../../revealui.config';

import { importMap } from './admin/importMap';
import './custom.css';

type Args = {
  children: React.ReactNode;
};

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </RootLayout>
);

export default Layout;
