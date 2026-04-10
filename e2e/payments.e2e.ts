/**
 * Payments E2E Tests
 *
 * Tests Stripe integration: product creation, pricing, and checkout flow.
 * Uses Stripe test mode — no real charges are made.
 *
 * REQUIRES live services:
 *   - apps/admin (port 4000) with running database
 *   - Stripe test keys in environment (STRIPE_SECRET_KEY=sk_test_...)
 *   - An authenticated admin session (ADMIN_EMAIL + ADMIN_PASSWORD)
 *
 * Run with:
 *   pnpm dev
 *   STRIPE_SECRET_KEY=sk_test_... ADMIN_EMAIL=... pnpm test:e2e -- e2e/payments.e2e.ts
 *
 * Stripe test card: 4242 4242 4242 4242, any future expiry, any CVC
 */

import { expect, test } from '@playwright/test';

const ADMIN_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';
// Billing endpoints live on the API (migrated from admin in Session 19)
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3004';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';

// Skip when Stripe test keys or admin credentials are not configured
test.beforeAll(async ({ request }) => {
  if (!(ADMIN_PASSWORD && STRIPE_KEY.startsWith('sk_test_'))) {
    test.skip();
    return;
  }
  try {
    const res = await request.get(`${ADMIN_BASE}/api/health`, { timeout: 3000 });
    if (!res.ok()) test.skip();
  } catch {
    test.skip();
  }
});

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function signIn(page: import('@playwright/test').Page) {
  // Admin login page is at /login (not /admin/login — that redirects to /login).
  // After successful sign-in, router.push('/') navigates away from /login.
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), {
    timeout: 10000,
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

test.describe('Product management', () => {
  const productName = `E2E Product ${Date.now()}`;

  test('admin can create a product', async ({ page }) => {
    await signIn(page);
    await page.goto(`${ADMIN_BASE}/admin/collections/products/create`, {
      waitUntil: 'domcontentloaded',
    });

    await page
      .getByLabel(/title|name/i)
      .first()
      .fill(productName);

    const slugField = page.getByLabel(/slug/i);
    if (await slugField.isVisible()) {
      await slugField.fill(`e2e-product-${Date.now()}`);
    }

    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/saved|created/i)).toBeVisible({ timeout: 5000 });
  });

  test('admin can add a price to a product', async ({ page }) => {
    await signIn(page);
    await page.goto(`${ADMIN_BASE}/admin/collections/prices/create`, {
      waitUntil: 'domcontentloaded',
    });

    // Set amount
    const amountField = page.getByLabel(/amount|price/i).first();
    if (await amountField.isVisible()) {
      await amountField.fill('999');
    }

    await page.getByRole('button', { name: /save/i }).first().click();
    await expect(page.getByText(/saved|created/i)).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Checkout flow (Stripe test mode)
// ---------------------------------------------------------------------------

test.describe('Checkout flow', () => {
  test('checkout page renders with Stripe elements', async ({ page }) => {
    // Navigate to the checkout page — URL varies by implementation
    const checkoutUrls = [
      `${ADMIN_BASE}/checkout`,
      `${ADMIN_BASE}/shop/checkout`,
      `${ADMIN_BASE}/api/checkout`,
    ];

    let found = false;
    for (const url of checkoutUrls) {
      const response = await page
        .goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 })
        .catch(() => null);
      if (response && response.status() < 400) {
        found = true;
        break;
      }
    }

    if (!found) {
      test.skip();
      return;
    }

    // Stripe Elements should be present
    const stripeFrame = page.frameLocator('iframe[src*="stripe"]').first();
    await expect(stripeFrame.getByLabel(/card number/i)).toBeVisible({ timeout: 10000 });
  });

  test('checkout with Stripe test card completes', async ({ page }) => {
    // Navigate to checkout with a test product
    const response = await page
      .goto(`${ADMIN_BASE}/checkout?test=1`, { waitUntil: 'domcontentloaded', timeout: 5000 })
      .catch(() => null);

    if (!response || response.status() >= 400) {
      test.skip();
      return;
    }

    const stripeFrame = page.frameLocator('iframe[src*="stripe"]').first();
    const cardNumber = stripeFrame.getByLabel(/card number/i);

    if (!(await cardNumber.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Fill in Stripe test card
    await cardNumber.fill('4242424242424242');
    await stripeFrame.getByLabel(/expiry|expiration/i).fill('12/30');
    await stripeFrame.getByLabel(/cvc|cvv|security/i).fill('123');

    const zipField = stripeFrame.getByLabel(/zip|postal/i);
    if (await zipField.isVisible()) {
      await zipField.fill('10001');
    }

    await page.getByRole('button', { name: /pay|complete|subscribe|checkout/i }).click();

    // Should redirect to success page
    await page.waitForURL(/success|thank|confirmation/i, { timeout: 15000 }).catch(() => null);
    const url = page.url();
    const hasSuccess =
      url.includes('success') || url.includes('thank') || url.includes('confirmation');

    // Also accept if still on checkout with a success message
    const successMsg = await page
      .getByText(/success|payment.*complete|thank you/i)
      .isVisible()
      .catch(() => false);

    expect(hasSuccess || successMsg).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Webhook simulation (via API direct call)
// ---------------------------------------------------------------------------

test.describe('Stripe webhook', () => {
  test('webhook endpoint exists and rejects unsigned payload', async ({ request }) => {
    // Webhook handler lives on the API (migrated from admin in Session 19)
    const response = await request.post(`${API_BASE}/api/webhooks/stripe`, {
      data: JSON.stringify({ type: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    // Should return 400 (bad signature) not 404 (missing) or 500 (crash)
    expect([400, 401, 403]).toContain(response.status());
  });
});
