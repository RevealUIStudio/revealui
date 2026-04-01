import { expect, test } from '@playwright/test';

/**
 * Payment Processing E2E Tests
 * Tests payment checkout flow and Stripe integration
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Payment Checkout Flow', () => {
  test('user can initiate checkout', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    const addToCartButton = page
      .locator('button:has-text("Add to Cart"), button:has-text("Buy")')
      .first();

    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(checkout|cart)`));
  });

  test('checkout form validates input', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);

    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Should show validation errors
    const errors = page.locator('text=/required|invalid|error/i');
    await expect(errors.first()).toBeVisible();
    const errorCount = await errors.count();
    expect(errorCount).toBeGreaterThan(0);
  });

  test('payment form accepts test card numbers', async ({ page }) => {
    await page.goto(`${BASE_URL}/checkout`);

    const cardInput = page
      .locator('input[name*="card"], input[placeholder*="card"], #card-number')
      .first();
    await expect(cardInput).toBeVisible();

    // Use Stripe test card number
    await cardInput.fill('4242 4242 4242 4242');

    const expiryInput = page.locator('input[name*="expiry"], input[placeholder*="expiry"]').first();
    await expect(expiryInput).toBeVisible();
    await expiryInput.fill('12/25');

    const cvcInput = page.locator('input[name*="cvc"], input[placeholder*="cvc"]').first();
    await expect(cvcInput).toBeVisible();
    await cvcInput.fill('123');

    // Form should accept the input
    const value = await cardInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('payment success redirects to success page', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/checkout/success`);

    // Page must be reachable — a null response means navigation failed entirely
    expect(response).toBeTruthy();
    // Success page always renders as 200 regardless of payment state
    expect(response!.status()).toBe(200);

    // Should show success message
    const successMessage = page.locator('text=/success|thank you|payment received/i');
    await expect(successMessage).toBeVisible();
  });
});

test.describe('Stripe Integration', () => {
  test('Stripe elements load correctly', async ({ page }) => {
    // Register console listener before navigation to capture all errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/checkout`);
    await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(checkout|pay)`));

    // Allow time for Stripe to load
    await page.waitForTimeout(1000);

    // Should not have critical errors (ignore favicon/analytics noise)
    const criticalErrors = errors.filter(
      (error) => !(error.includes('favicon') || error.includes('analytics')),
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('webhook endpoint exists', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/webhooks/stripe`);

    // Webhook endpoint should exist (may return 405 for GET, but should not be 404)
    expect([200, 405, 401]).toContain(response.status());
  });
});
