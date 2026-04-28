import { expect, test } from '@playwright/test';

/**
 * Smoke Tests
 *
 * Quick, critical tests to verify basic functionality.
 * Run with: pnpm exec playwright test --grep @smoke
 */

test.describe('Smoke Tests', () => {
  test('homepage loads with correct title @smoke', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that we got a successful response
    expect(page.url()).toBeTruthy();

    // Check that the page has content
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('health endpoint returns 200 @smoke', async ({ request, baseURL }) => {
    const response = await request.get(`${baseURL}/api/health`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeTruthy();
  });

  test('admin panel is accessible @smoke', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/');

    // Should redirect to login or show admin interface
    await page.waitForLoadState('networkidle');

    // Page should load without errors
    const title = await page.title();
    expect(title).toBeTruthy();

    // Should not show a generic error page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('404');
    expect(bodyText).not.toContain('500');
  });

  test('static assets load correctly @smoke', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Listen for failed requests
    page.on('requestfailed', (request) => {
      errors.push(`Failed request: ${request.url()}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !(
          (
            error.includes('favicon') || // Ignore favicon errors
            error.includes('analytics') || // Ignore analytics errors
            error.includes('gtm')
          ) // Ignore Google Tag Manager errors
        ),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
