'use client';

import {
  CookieConsentBanner,
  CookieConsentProvider,
  useCookieConsent,
} from '@revealui/presentation';
import { resolveComplianceProfile } from '@revealui/security';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { ReactNode } from 'react';

const profile = resolveComplianceProfile(
  typeof process !== 'undefined' ? process.env : ({} as Record<string, string | undefined>),
);

function SpeedInsightsWhenAllowed() {
  const { consent, decided } = useCookieConsent();
  if (!profile.allowThirdPartyTelemetry) {
    return null;
  }
  if (!process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return null;
  }
  if (!decided || !consent.analytics) {
    return null;
  }
  return <SpeedInsights />;
}

export function CookieConsentRoot({
  children,
  isFleetMode = false,
}: {
  children: ReactNode;
  isFleetMode?: boolean;
}): ReactNode {
  return (
    <CookieConsentProvider
      allowOptionalCookies={profile.allowOptionalCookies}
      policyHref="https://revealui.com/cookies"
      privacyHref="https://revealui.com/privacy"
    >
      {children}
      {isFleetMode ? null : <CookieConsentBanner />}
      {isFleetMode ? null : <SpeedInsightsWhenAllowed />}
    </CookieConsentProvider>
  );
}
