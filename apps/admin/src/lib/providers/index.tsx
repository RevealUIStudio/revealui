import { resolveComplianceProfile } from '@revealui/security';
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
  const compliance = resolveComplianceProfile(process.env);
  return (
    <ElectricProvider
      serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}
      debug={process.env.NODE_ENV === 'development'}
    >
      <ThemeProvider>
        <HeaderThemeProvider>
          <LicenseProvider isFleetMode={isFleetMode}>
            <CookieConsentRoot
              isFleetMode={isFleetMode}
              allowOptionalCookies={compliance.allowOptionalCookies}
              allowThirdPartyTelemetry={compliance.allowThirdPartyTelemetry}
            >
              <AuthRequiredListener />
              <IdleSessionGuard sessionIdleTimeoutSeconds={compliance.sessionIdleTimeoutSeconds} />
              {children}
              {isFleetMode ? null : <UpgradeDialog />}
            </CookieConsentRoot>
          </LicenseProvider>
        </HeaderThemeProvider>
      </ThemeProvider>
    </ElectricProvider>
  );
};
