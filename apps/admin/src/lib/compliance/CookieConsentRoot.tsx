'use client';

import {
  CookieConsentBanner,
  CookieConsentProvider,
  useCookieConsent,
} from '@revealui/presentation';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';

export interface CookieConsentRootProps {
  children: ReactNode;
  isFleetMode?: boolean;
  allowOptionalCookies: boolean;
  allowThirdPartyTelemetry: boolean;
}

function SpeedInsightsWhenAllowed({
  allowThirdPartyTelemetry,
}: {
  allowThirdPartyTelemetry: boolean;
}): ReactNode {
  const { consent, decided } = useCookieConsent();
  if (!allowThirdPartyTelemetry) {
    return null;
  }
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return null;
  }
  if (!(decided && consent.analytics)) {
    return null;
  }
  return <SpeedInsights />;
}

export function CookieConsentRoot({
  children,
  isFleetMode = false,
  allowOptionalCookies,
  allowThirdPartyTelemetry,
}: CookieConsentRootProps): ReactNode {
  return (
    <CookieConsentProvider
      allowOptionalCookies={allowOptionalCookies}
      policyHref="https://revealui.com/cookies"
      privacyHref="https://revealui.com/privacy"
    >
      {children}
      {isFleetMode ? null : <CookieConsentBanner />}
      {isFleetMode ? null : (
        <SpeedInsightsWhenAllowed allowThirdPartyTelemetry={allowThirdPartyTelemetry} />
      )}
    </CookieConsentProvider>
  );
}
