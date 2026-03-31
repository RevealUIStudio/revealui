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
});
