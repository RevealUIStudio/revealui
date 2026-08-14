import {
  CookieConsentBanner,
  CookieConsentProvider,
  useCookieConsent,
} from '@revealui/presentation';
import { SpeedInsights } from '@vercel/speed-insights/react';
import type { ReactNode } from 'react';
import { isHipaaComplianceProfile } from '../lib/compliance';

function SpeedInsightsWhenAllowed() {
  const { consent, decided } = useCookieConsent();
  if (isHipaaComplianceProfile()) {
    return null;
  }
  if (!(decided && consent.analytics)) {
    return null;
  }
  return <SpeedInsights />;
}

export function ConsentGatedTelemetry({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider allowOptionalCookies={!isHipaaComplianceProfile()}>
      {children}
      <CookieConsentBanner />
      <SpeedInsightsWhenAllowed />
    </CookieConsentProvider>
  );
}
