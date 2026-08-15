import { expect, type Page } from '@playwright/test';

/** Decided reject-optional record. Same shape CookieConsentManager persists. */
export const DECIDED_CONSENT = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  version: 1,
  updatedAt: '2026-08-01T00:00:00.000Z',
  source: 'explicit',
} as const;

export function decidedConsentSerialized(): string {
  return JSON.stringify(DECIDED_CONSENT);
}

/**
 * storageState fragment so contexts created with e2e/.auth/user.json already
 * have a decided consent record. storageState restore runs after init scripts
 * and would otherwise wipe a beforeEach seed.
 */
export function consentStorageState(origin: string): {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Lax';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
} {
  const serialized = decidedConsentSerialized();
  const hostname = new URL(origin).hostname;
  return {
    cookies: [
      {
        name: 'revealui-cookie-consent',
        value: encodeURIComponent(serialized),
        domain: hostname,
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: origin.startsWith('https:'),
        sameSite: 'Lax',
      },
    ],
    origins: [
      {
        origin,
        localStorage: [{ name: 'cookie-consent', value: serialized }],
      },
    ],
  };
}

/**
 * Lockstep with CookieConsentProvider: set on <html> after client hydrate.
 * Visual snapshots wait for this so a client-only banner has either appeared
 * or stayed absent once the stored decision is read.
 */
export const COOKIE_CONSENT_READY_SELECTOR = 'html[data-cookie-consent-ready]';

/**
 * If the first-visit banner is up, reject it so page goldens stay banner-free.
 *
 * Locators are scoped to the dialog and use exact names. Playwright's default
 * name match is a substring, so `{ name: 'OK' }` also hits "Cookie settings"
 * ("Cookie" contains "ok") and re-opens the banner instead of dismissing it.
 */
export async function dismissCookieBannerIfPresent(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog', { name: /^(Cookies|Necessary cookies only)$/ });
  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }
  const action = dialog.getByRole('button', { name: /^(Reject all|OK)$/ });
  await action.click();
  await expect(dialog).toBeHidden();
}
