/**
 * Visual Snapshot E2E Tests
 *
 * Tests that capture and compare visual snapshots of UI components and pages.
 * These tests ensure visual consistency across changes and detect unintended
 * visual regressions.
 *
 * Unauthenticated tests (login page, error states) run without storageState.
 * Authenticated tests (collections, globals, responsive, theme, cross-browser)
 * use the storageState written by global-setup.ts (e2e/.auth/user.json) so
 * each route renders its actual content rather than the /login redirect.
 *
 * If ADMIN_EMAIL/ADMIN_PASSWORD were not set during setup, e2e/.auth/user.json
 * will contain an empty cookie list and the authenticated tests will redirect
 * to /login — run global-setup again with credentials to populate the state.
 *
 * Every snapshot seeds a decided consent record before navigation so the
 * first-visit cookie banner cannot cover the page under test. Banner chrome
 * is locked by the presentation unit tests, not these goldens.
 *
 * Usage:
 * - Run tests: pnpm test:e2e:visual
 * - Update snapshots: pnpm test:e2e:visual:update
 * - View report: pnpm test:e2e:report
 */

import { expect, type Page, test } from '@playwright/test';
import { waitForNetworkIdle } from './utils/test-helpers';

const AUTH_STATE = 'e2e/.auth/user.json';

/** Decided consent so page snapshots are not coupled to the first-visit banner. */
const DECIDED_CONSENT = JSON.stringify({
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  version: 1,
  updatedAt: '2026-08-01T00:00:00.000Z',
  source: 'explicit',
});

async function seedDecidedConsent(page: Page): Promise<void> {
  await page.addInitScript((serialized) => {
    // Same write as CookieConsentManager.writeConsentCookie: encoded value, Path=/.
    // Origin-independent so PLAYWRIGHT_BASE_URL / storageState cannot drop it.
    // biome-ignore lint/suspicious/noDocumentCookie: e2e seeds the first-party consent cookie the manager reads
    document.cookie = `revealui-cookie-consent=${encodeURIComponent(serialized)}; Path=/; Max-Age=15552000; SameSite=Lax`;
    window.localStorage.setItem('cookie-consent', serialized);
  }, DECIDED_CONSENT);
}

test.describe('Visual Snapshots - Admin Application', () => {
  test.beforeEach(async ({ page }) => {
    await seedDecidedConsent(page);
  });

  test.describe('Unauthenticated States', () => {
    test('login page should match snapshot', async ({ page }) => {
      await page.goto('/login');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-login-page.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Error States', () => {
    test('404 page should match snapshot', async ({ page }) => {
      await page.goto('/non-existent-page-that-should-404');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('404-page.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Authenticated Admin Pages', () => {
    test.use({ storageState: AUTH_STATE });

    test('collections page should match snapshot', async ({ page }) => {
      await page.goto('/collections');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-collections.png', {
        fullPage: true,
      });
    });

    test('globals page should match snapshot', async ({ page }) => {
      await page.goto('/globals');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-globals.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Responsive Snapshots', () => {
    test.use({ storageState: AUTH_STATE });

    test('collections page on mobile viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/collections');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-collections-mobile.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Theme Snapshots', () => {
    test.use({ storageState: AUTH_STATE });

    test('collections page with dark color scheme should match snapshot', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/collections');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-collections-dark-mode.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Cross-Browser Consistency', () => {
    test.use({ storageState: AUTH_STATE });

    test('collections page should be visually consistent across browsers', async ({ page }) => {
      await page.goto('/collections');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('cross-browser-admin-collections.png', {
        fullPage: true,
      });
    });
  });
});
