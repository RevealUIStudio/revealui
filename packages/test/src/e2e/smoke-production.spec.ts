import { expect, test } from '@playwright/test';

/**
 * Production Smoke Tests
 *
 * These tests run against LIVE production URLs (revealui.com, api.revealui.com,
 * cms.revealui.com) and verify critical user-facing functionality is working.
 *
 * Run with: pnpm exec playwright test --grep @smoke
 */

test.describe('Production Smoke Tests', () => {
  test('BuiltWithRevealUI badge renders in footer @smoke', async ({ page }) => {
    await page.goto('https://revealui.com');

    // Scroll to footer to ensure it is in view
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();

    // Find the badge link inside the footer
    const badge = footer.locator('a[href="https://revealui.com"]');
    await expect(badge).toBeVisible();

    // Verify it contains the expected text
    await expect(badge).toContainText('Built with RevealUI');

    // Verify the badge contains an SVG icon
    const svg = badge.locator('svg');
    await expect(svg).toBeAttached();
  });

  test('pricing page loads with live Stripe prices @smoke', async ({ page, request }) => {
    // First verify the pricing API returns expected data
    const apiResponse = await request.get('https://api.revealui.com/api/pricing');
    expect(apiResponse.status()).toBe(200);

    const pricing = await apiResponse.json();
    expect(pricing).toBeTruthy();

    // Now verify the marketing pricing page renders
    await page.goto('https://revealui.com/pricing');

    // Wait for pricing content to appear
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();

    // Verify all 4 tier names are displayed
    const pageText = await body.textContent();
    expect(pageText).toBeTruthy();

    // Free tier
    expect(pageText).toContain('Free');

    // Pro tier
    expect(pageText).toContain('Pro');

    // Max tier
    expect(pageText).toContain('Max');

    // Enterprise/Forge tier
    const hasEnterprise = pageText!.includes('Enterprise') || pageText!.includes('Forge');
    expect(hasEnterprise).toBe(true);

    // Verify dollar amounts are rendered on the page
    expect(pageText).toContain('$0');
    expect(pageText).toContain('$49');
    expect(pageText).toContain('$149');
  });

  test('signup redirect flow and login page @smoke', async ({ page }) => {
    // CMS root without session should redirect to login
    await page.goto('https://cms.revealui.com');
    await page.waitForURL(/\/(login|signin|admin)/);

    const currentUrl = page.url();
    const isLoginRelated =
      currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl.includes('admin');
    expect(isLoginRelated).toBe(true);

    // Verify login form has email and password fields
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    await expect(passwordInput).toBeVisible();

    // Verify there is a sign-up link or button
    const signupLink = page.locator(
      'a:has-text("sign up"), a:has-text("Sign up"), a:has-text("Sign Up"), a:has-text("Create account"), a:has-text("Register")',
    );
    await expect(signupLink.first()).toBeVisible();

    // Also verify the signup page is accessible
    await page.goto('https://cms.revealui.com/signup');

    // Should either show a signup form or redirect to login
    const signupUrl = page.url();
    const isSignupOrLogin =
      signupUrl.includes('signup') ||
      signupUrl.includes('login') ||
      signupUrl.includes('signin') ||
      signupUrl.includes('register');
    expect(isSignupOrLogin).toBe(true);

    // Page should not show a server error
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('500');
    expect(bodyText).not.toContain('Internal Server Error');
  });

  test('performance budget — homepage and pricing load under 5s @smoke', async ({ page }) => {
    // Homepage performance
    await page.goto('https://revealui.com');
    const homepageLoadTime = await page.evaluate(
      () => performance.timing.loadEventEnd - performance.timing.navigationStart,
    );
    expect(homepageLoadTime).toBeGreaterThan(0);
    expect(homepageLoadTime).toBeLessThan(5000);

    // Pricing page performance
    await page.goto('https://revealui.com/pricing');
    const pricingLoadTime = await page.evaluate(
      () => performance.timing.loadEventEnd - performance.timing.navigationStart,
    );
    expect(pricingLoadTime).toBeGreaterThan(0);
    expect(pricingLoadTime).toBeLessThan(5000);
  });

  test('security headers are present @smoke', async ({ request }) => {
    const response = await request.get('https://revealui.com');
    const headers = response.headers();

    // X-Frame-Options or CSP frame-ancestors must be present
    const hasFrameProtection =
      headers['x-frame-options'] !== undefined ||
      (headers['content-security-policy'] !== undefined &&
        headers['content-security-policy'].includes('frame-ancestors'));
    expect(hasFrameProtection).toBe(true);

    // Strict-Transport-Security (HSTS)
    expect(headers['strict-transport-security']).toBeTruthy();

    // X-Content-Type-Options
    expect(headers['x-content-type-options']).toBeTruthy();
  });

  test('OAuth buttons have valid hrefs on login page @smoke', async ({ page }) => {
    await page.goto('https://cms.revealui.com/login');

    // Wait for the login form to be visible
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();

    const providers = ['GitHub', 'Google', 'Vercel'];

    for (const provider of providers) {
      // Look for links or buttons containing the provider name (case-insensitive)
      const links = page.locator(`a:has-text("${provider}")`);
      const linkCount = await links.count();

      if (linkCount > 0) {
        // Verify each matching link has a valid href
        for (let i = 0; i < linkCount; i++) {
          const href = await links.nth(i).getAttribute('href');
          expect(href).toBeTruthy();
          const isValidHref = href!.startsWith('https://') || href!.startsWith('/api/auth/');
          expect(isValidHref).toBe(true);
        }
      }

      // Also check buttons — they don't have hrefs but should at least exist if rendered
      const buttons = page.locator(`button:has-text("${provider}")`);
      const buttonCount = await buttons.count();

      // If a provider exists as either link or button, that's fine.
      // We only log which ones were found; we don't fail if a provider is missing.
      if (linkCount === 0 && buttonCount === 0) {
      }
    }
  });

  test('API OpenAPI spec is valid @smoke', async ({ request }) => {
    const response = await request.get('https://api.revealui.com/openapi.json');
    expect(response.status()).toBe(200);

    const spec = await response.json();

    // Verify it's an OpenAPI 3.x spec
    expect(spec.openapi).toBeTruthy();
    expect(spec.openapi.startsWith('3.')).toBe(true);

    // Verify endpoints are defined
    expect(spec.paths).toBeTruthy();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
  });

  test('visual regression — homepage and pricing @smoke', async ({ page }) => {
    // Note: On first run, Playwright creates baseline screenshots automatically.
    // Subsequent runs compare against these baselines. Update baselines with:
    //   pnpm exec playwright test --update-snapshots

    // Homepage visual regression
    await page.goto('https://revealui.com');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('homepage.png', { maxDiffPixelRatio: 0.05 });

    // Pricing page visual regression
    await page.goto('https://revealui.com/pricing');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveScreenshot('pricing.png', { maxDiffPixelRatio: 0.05 });
  });
});
