import { ElectricProvider } from '@revealui/sync/provider';
import type React from 'react';
import { UpgradeDialog } from '@/lib/components/UpgradeDialog';
import { HeaderThemeProvider } from './HeaderTheme/index';
import { LicenseProvider } from './LicenseProvider';
import { ThemeProvider } from './Theme/index';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ElectricProvider
      serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}
      debug={process.env.NODE_ENV === 'development'}
    >
      <ThemeProvider>
        <HeaderThemeProvider>
          <LicenseProvider>
            {children}
            <UpgradeDialog />
          </LicenseProvider>
        </HeaderThemeProvider>
      </ThemeProvider>
    </ElectricProvider>
  );
};
