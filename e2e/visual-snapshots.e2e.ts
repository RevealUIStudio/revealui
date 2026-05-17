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
 * Usage:
 * - Run tests: pnpm test:e2e:visual
 * - Update snapshots: pnpm test:e2e:visual:update
 * - View report: pnpm test:e2e:report
 */

import { expect, test } from '@playwright/test';
import { waitForNetworkIdle } from './utils/test-helpers';

const AUTH_STATE = 'e2e/.auth/user.json';

test.describe('Visual Snapshots - Admin Application', () => {
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
