import { useCookieConsent } from '@revealui/presentation';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieConsentRoot } from '../CookieConsentRoot';

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => <div data-testid="speed-insights" />,
}));

function AnalyticsProbe() {
  const { consent } = useCookieConsent();
  return <span data-testid="analytics">{String(consent.analytics)}</span>;
}

function persistAcceptAll(): void {
  const record = {
    necessary: true,
    functional: true,
    analytics: true,
    marketing: true,
    version: 1,
    updatedAt: new Date().toISOString(),
    source: 'explicit',
  };
  const serialized = JSON.stringify(record);
  document.cookie = `revealui-cookie-consent=${encodeURIComponent(serialized)}; Path=/`;
  localStorage.setItem('cookie-consent', serialized);
}

describe('CookieConsentRoot', () => {
  beforeEach(() => {
    document.cookie = 'revealui-cookie-consent=; Max-Age=0; Path=/';
    localStorage.removeItem('cookie-consent');
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    process.env.REVEALUI_COMPLIANCE_PROFILE = 'hipaa';
  });

  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.REVEALUI_COMPLIANCE_PROFILE;
    document.cookie = 'revealui-cookie-consent=; Max-Age=0; Path=/';
    localStorage.removeItem('cookie-consent');
  });

  it('keeps Speed Insights off when the server forbids third-party telemetry', () => {
    persistAcceptAll();

    render(
      <CookieConsentRoot allowOptionalCookies={false} allowThirdPartyTelemetry={false}>
        <AnalyticsProbe />
      </CookieConsentRoot>,
    );

    expect(screen.getByTestId('analytics')).toHaveTextContent('false');
    expect(screen.queryByTestId('speed-insights')).not.toBeInTheDocument();
  });

  it('does not offer optional cookies when the server forbids them, even if env is unset', () => {
    delete process.env.REVEALUI_COMPLIANCE_PROFILE;
    render(
      <CookieConsentRoot allowOptionalCookies={false} allowThirdPartyTelemetry={true}>
        <span>child</span>
      </CookieConsentRoot>,
    );
    expect(screen.queryByRole('button', { name: 'Accept all' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Analytics' })).not.toBeInTheDocument();
  });
});
