/**
 * Visual Snapshot E2E Tests
 *
 * Tests that capture and compare visual snapshots of UI components and pages.
 * These tests ensure visual consistency across changes and detect unintended
 * visual regressions.
 *
 * Updated to target actual admin routes that exist in the application.
 *
 * Usage:
 * - Run tests: pnpm test:e2e:visual
 * - Update snapshots: pnpm test:e2e:visual:update
 * - View report: pnpm test:e2e:report
 */

import { expect, test } from '@playwright/test';
import { waitForNetworkIdle } from './utils/test-helpers';

test.describe('Visual Snapshots - Admin Application', () => {
  test.describe('Admin Panel', () => {
    test('admin login page should match snapshot', async ({ page }) => {
      await page.goto('/login');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-login-page.png', {
        fullPage: true,
      });
    });

    test('admin collections page should match snapshot', async ({ page }) => {
      await page.goto('/collections');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-collections.png', {
        fullPage: true,
      });
    });

    test('admin globals page should match snapshot', async ({ page }) => {
      await page.goto('/globals');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-globals.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Responsive Snapshots', () => {
    test('admin login on mobile viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/login');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-login-mobile.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Theme Snapshots', () => {
    test('admin login with dark color scheme should match snapshot', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/login');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-login-dark-mode.png', {
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

  test.describe('Cross-Browser Consistency', () => {
    test('admin login should be visually consistent across browsers', async ({ page }) => {
      await page.goto('/login');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('cross-browser-admin-login.png', {
        fullPage: true,
      });
    });
  });
});
