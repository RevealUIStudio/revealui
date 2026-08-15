import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COOKIE_CONSENT_READY_ATTR,
  CookieConsentBanner,
  CookieConsentManager,
  CookieConsentProvider,
  CookieSettingsButton,
  useCookieConsent,
} from '../../cookie-consent/index.js';

function AnalyticsProbe() {
  const { consent, decided } = useCookieConsent();
  return (
    <div>
      <span data-testid="decided">{String(decided)}</span>
      <span data-testid="analytics">{String(consent.analytics)}</span>
    </div>
  );
}

beforeEach(() => {
  document.cookie = 'revealui-cookie-consent=; Max-Age=0; Path=/';
  localStorage.removeItem('cookie-consent');
});

afterEach(() => {
  document.cookie = 'revealui-cookie-consent=; Max-Age=0; Path=/';
  localStorage.removeItem('cookie-consent');
  document.documentElement.removeAttribute(COOKIE_CONSENT_READY_ATTR);
});

function renderBanner(options?: {
  allowOptionalCookies?: boolean;
  manager?: CookieConsentManager;
}) {
  const manager = options?.manager ?? new CookieConsentManager();
  return render(
    <CookieConsentProvider
      manager={manager}
      allowOptionalCookies={options?.allowOptionalCookies ?? true}
    >
      <CookieConsentBanner />
      <CookieSettingsButton />
      <AnalyticsProbe />
    </CookieConsentProvider>,
  );
}

describe('CookieConsentBanner', () => {
  it('shows accept and reject with equal actions before a decision', () => {
    renderBanner();
    expect(screen.getByRole('dialog', { name: 'Cookies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject all' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/cookies');
    expect(screen.getByTestId('analytics')).toHaveTextContent('false');
  });

  it('caps height so a phone login form stays reachable', () => {
    renderBanner();
    const dialog = screen.getByRole('dialog', { name: 'Cookies' });
    expect(dialog.className).toContain('max-h-[min(42vh,22rem)]');
    expect(dialog.className).toContain('overflow-y-auto');
    expect(dialog.className).toContain('bottom-0');
    expect(dialog.className).not.toContain('inset-0');
  });

  it('accept all grants analytics and hides the banner', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(screen.getByTestId('decided')).toHaveTextContent('true');
    expect(screen.getByTestId('analytics')).toHaveTextContent('true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reject all keeps analytics off and hides the banner', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: 'Reject all' }));
    expect(screen.getByTestId('decided')).toHaveTextContent('true');
    expect(screen.getByTestId('analytics')).toHaveTextContent('false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('customize then save persists only the toggled categories', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: 'Customize' }));
    await user.click(screen.getByRole('switch', { name: 'Analytics' }));
    await user.click(screen.getByRole('button', { name: 'Save choices' }));
    expect(screen.getByTestId('analytics')).toHaveTextContent('true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cookie settings reopens the banner after a decision', async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.click(screen.getByRole('button', { name: 'Reject all' }));
    await user.click(screen.getByRole('button', { name: 'Cookie settings' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('HIPAA mode records deny-optional immediately and does not offer analytics', async () => {
    const user = userEvent.setup();
    renderBanner({ allowOptionalCookies: false });
    expect(screen.getByTestId('decided')).toHaveTextContent('true');
    expect(screen.getByTestId('analytics')).toHaveTextContent('false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept all' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cookie settings' }));
    expect(screen.getByRole('dialog', { name: 'Necessary cookies only' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Analytics' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not paint the banner when a decision is already stored', () => {
    const manager = new CookieConsentManager();
    manager.rejectAll();
    renderBanner({ manager });
    expect(document.documentElement.getAttribute(COOKIE_CONSENT_READY_ATTR)).toBe('1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('decided')).toHaveTextContent('true');
  });

  it('wipes a prior accept-all before children read consent when optional cookies are forbidden', () => {
    const manager = new CookieConsentManager();
    manager.acceptAll();
    expect(manager.getConsent().analytics).toBe(true);

    renderBanner({ allowOptionalCookies: false, manager });

    expect(screen.getByTestId('analytics')).toHaveTextContent('false');
    expect(manager.getConsent().analytics).toBe(false);
    expect(manager.getConsent().functional).toBe(false);
    expect(manager.getConsent().marketing).toBe(false);
  });
});
