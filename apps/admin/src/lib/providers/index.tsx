import { ElectricProvider } from '@revealui/sync/provider';
import type React from 'react';
import { AuthRequiredListener } from '@/lib/auth/AuthRequiredListener';
import { CookieConsentRoot } from '@/lib/compliance/CookieConsentRoot';
import { IdleSessionGuard } from '@/lib/compliance/IdleSessionGuard';
import { UpgradeDialog } from '@/lib/components/UpgradeDialog';
import { HeaderThemeProvider } from './HeaderTheme/index';
import { LicenseProvider } from './LicenseProvider';
import { ThemeProvider } from './Theme/index';

interface ProvidersProps {
  children: React.ReactNode;
  isFleetMode?: boolean;
}

export const Providers = ({ children, isFleetMode = false }: ProvidersProps) => {
  return (
    <ElectricProvider
      serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}
      debug={process.env.NODE_ENV === 'development'}
    >
      <ThemeProvider>
        <HeaderThemeProvider>
          <LicenseProvider isFleetMode={isFleetMode}>
            <CookieConsentRoot isFleetMode={isFleetMode}>
              <AuthRequiredListener />
              <IdleSessionGuard />
              {children}
              {isFleetMode ? null : <UpgradeDialog />}
            </CookieConsentRoot>
          </LicenseProvider>
        </HeaderThemeProvider>
      </ThemeProvider>
    </ElectricProvider>
  );
};
