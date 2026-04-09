/**
 * Visual Snapshot E2E Tests
 *
 * Tests that capture and compare visual snapshots of UI components and pages.
 * These tests ensure visual consistency across changes and detect unintended
 * visual regressions.
 *
 * Updated to target actual CMS routes that exist in the application.
 *
 * Usage:
 * - Run tests: pnpm test:e2e:visual
 * - Update snapshots: pnpm test:e2e:visual:update
 * - View report: pnpm test:e2e:report
 */

import { expect, test } from '@playwright/test';
import { waitForNetworkIdle } from './utils/test-helpers';

test.describe('Visual Snapshots - CMS Application', () => {
  test.describe('Admin Panel', () => {
    test('admin login page should match snapshot', async ({ page }) => {
      await page.goto('/admin/login');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-login-page.png', {
        fullPage: true,
      });
    });

    test('admin dashboard should match snapshot', async ({ page }) => {
      await page.goto('/admin');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-dashboard.png', {
        fullPage: true,
      });
    });

    test('admin collections page should match snapshot', async ({ page }) => {
      await page.goto('/admin/collections');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-collections.png', {
        fullPage: true,
      });
    });

    test('admin globals page should match snapshot', async ({ page }) => {
      await page.goto('/admin/globals');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('admin-globals.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Frontend Pages', () => {
    test('home page should match snapshot', async ({ page }) => {
      await page.goto('/');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('home-page.png', {
        fullPage: true,
      });
    });

    test('posts listing page should match snapshot', async ({ page }) => {
      await page.goto('/posts');
      await waitForNetworkIdle(page);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('posts-listing.png', {
        fullPage: true,
      });
    });

    test('home page navigation header should match snapshot', async ({ page }) => {
      await page.goto('/');
      await waitForNetworkIdle(page);

      const header = page.locator('header, nav').first();
      if ((await header.count()) > 0 && (await header.isVisible())) {
        await expect(header).toHaveScreenshot('navigation-header.png');
      }
    });

    test('home page footer should match snapshot', async ({ page }) => {
      await page.goto('/');
      await waitForNetworkIdle(page);

      const footer = page.locator('footer').first();
      if ((await footer.count()) > 0) {
        await expect(footer).toHaveScreenshot('footer.png');
      }
    });
  });

  test.describe('Responsive Snapshots', () => {
    test('home page on mobile viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('home-page-mobile.png', {
        fullPage: true,
      });
    });

    test('admin login on mobile viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/admin/login');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-login-mobile.png', {
        fullPage: true,
      });
    });

    test('home page on tablet viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('home-page-tablet.png', {
        fullPage: true,
      });
    });

    test('admin dashboard on tablet viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/admin');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-dashboard-tablet.png', {
        fullPage: true,
      });
    });

    test('home page on desktop viewport should match snapshot', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('home-page-desktop.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Theme Snapshots', () => {
    test('home page with dark color scheme should match snapshot', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('home-page-dark-mode.png', {
        fullPage: true,
      });
    });

    test('admin login with dark color scheme should match snapshot', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/admin/login');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('admin-login-dark-mode.png', {
        fullPage: true,
      });
    });

    test('home page with light color scheme should match snapshot', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('home-page-light-mode.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Accessibility Snapshots', () => {
    test('home page with high contrast mode should match snapshot', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
      await page.goto('/');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('home-page-high-contrast.png', {
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
    test('home page should be visually consistent across browsers', async ({ page }) => {
      await page.goto('/');
      await waitForNetworkIdle(page);

      // This will create separate snapshots for chromium, firefox, webkit
      // based on the project name
      await expect(page).toHaveScreenshot('cross-browser-home.png', {
        fullPage: true,
      });
    });

    test('admin login should be visually consistent across browsers', async ({ page }) => {
      await page.goto('/admin/login');
      await waitForNetworkIdle(page);

      await expect(page).toHaveScreenshot('cross-browser-admin-login.png', {
        fullPage: true,
      });
    });
  });

  test.describe('Animation Control', () => {
    test('home page with animations disabled should match snapshot', async ({ page }) => {
      await page.goto('/');
      await waitForNetworkIdle(page);

      // Animations are already disabled via config
      await expect(page).toHaveScreenshot('home-page-no-animations.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });

  test.describe('Masked Snapshots', () => {
    test('home page with dynamic content masked should match snapshot', async ({ page }) => {
      await page.goto('/');
      await waitForNetworkIdle(page);

      // Mask dynamic elements like timestamps, user avatars, etc.
      await expect(page).toHaveScreenshot('home-page-masked.png', {
        fullPage: true,
        mask: [
          page.locator('[data-testid="timestamp"]'),
          page.locator('time'),
          page.locator('[data-testid="dynamic-content"]'),
        ],
      });
    });
  });
});
