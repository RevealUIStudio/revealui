/**
 * Billing Checkout E2E Tests
 *
 * Playwright tests that automate the full Stripe checkout flow:
 *   API checkout session creation → Stripe hosted checkout → redirect verification
 *
 * ─── PREREQUISITES ──────────────────────────────────────────────────────────────
 *   1. API (apps/api) and Admin (apps/admin) must be running
 *   2. Stripe test mode keys configured (sk_test_...)
 *   3. Authenticated user session (CMS_ADMIN_EMAIL + ADMIN_PASSWORD)
 *
 * ─── REQUIRED ENV VARS ──────────────────────────────────────────────────────────
 *   STRIPE_SECRET_KEY        sk_test_... (Stripe test key — never charged)
 *   CMS_ADMIN_EMAIL          admin@example.com
 *   ADMIN_PASSWORD       <your-admin-password>
 *
 * ─── OPTIONAL ENV VARS ──────────────────────────────────────────────────────────
 *   API_BASE_URL             defaults to http://localhost:3004
 *   PLAYWRIGHT_BASE_URL      defaults to http://localhost:4000
 *
 * Stripe test card: 4242 4242 4242 4242 | exp 12/30 | CVC 123
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   CMS_ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD='...' \
 *   pnpm test:e2e -- --project=chromium e2e/billing-checkout.e2e.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

// ─── Config ──────────────────────────────────────────────────────────────────

const ApiBase = (process.env.API_BASE_URL || 'http://localhost:3004').replace(/\/$/, '');
const CmsBase = (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';

const hasCredentials = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;
const hasStripeKey = STRIPE_KEY.startsWith('sk_test_');

// Absolute path to the auth state file
const AUTH_STATE_PATH = join(import.meta.dirname, '.auth', 'user.json');

// ─── Session cache ───────────────────────────────────────────────────────────

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
}

interface SessionCache {
  cookieHeader: string;
  cookie: PlaywrightCookie;
}

let _session: SessionCache | null | undefined;

/**
 * Ensure an authenticated session exists. Uses the saved auth state from
 * global-setup, validates it, then falls back to a fresh API sign-in.
 * Caches the result for the entire test run (at most one sign-in).
 */
async function ensureSession(page: Page): Promise<SessionCache | null> {
  if (_session !== undefined) {
    if (_session) await page.context().addCookies([_session.cookie]);
    return _session;
  }

  // Try saved auth state from global-setup
  try {
    const raw = await readFile(AUTH_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { cookies?: { name: string; value: string }[] };
    if (Array.isArray(parsed?.cookies) && parsed.cookies.length > 0) {
      const saved = parsed.cookies[0];
      const cookieHeader = `${saved.name}=${saved.value}`;

      // Validate the cookie against the API
      const checkRes = await page.request.get(`${ApiBase}/api/billing/subscription`, {
        headers: { cookie: cookieHeader },
      });

      if (checkRes.ok()) {
        const cookie: PlaywrightCookie = {
          name: saved.name,
          value: saved.value,
          domain: new URL(CmsBase).hostname.replace(/^[^.]+\./, '.'),
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: CmsBase.startsWith('https'),
          sameSite: 'Lax',
        };
        await page.context().addCookies([cookie]);
        _session = { cookieHeader, cookie };
        return _session;
      }
    }
  } catch {
    // Auth state file missing or invalid — fall through
  }

  // Fresh sign-in (at most once per run)
  const res = await page.request.post(`${CmsBase}/api/auth/sign-in`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    _session = null;
    return null;
  }

  const contextCookies = await page.context().cookies(CmsBase);
  const rawCookie = contextCookies[0];
  if (!rawCookie) {
    _session = null;
    return null;
  }

  const cookie: PlaywrightCookie = {
    ...rawCookie,
    domain: new URL(CmsBase).hostname.replace(/^[^.]+\./, '.'),
  };
  const cookieHeader = `${cookie.name}=${cookie.value}`;

  _session = { cookieHeader, cookie };
  return _session;
}

/**
 * Authenticate and return a session cookie string for API calls.
 * Returns null if authentication fails.
 */
async function getSessionCookie(page: Page): Promise<string | null> {
  const session = await ensureSession(page);
  return session?.cookieHeader ?? null;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Billing Checkout E2E', { tag: '@billing' }, () => {
  // Skip entire suite if no Stripe key
  test.skip(!process.env.STRIPE_SECRET_KEY, 'Requires STRIPE_SECRET_KEY');

  // ─── API endpoint tests (verify checkout session creation) ─────────────────

  test('Subscription checkout (pro) returns Stripe URL', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + ADMIN_PASSWORD');
    const sessionCookie = await getSessionCookie(page);
    test.skip(!sessionCookie, 'No valid session — authentication failed');

    const response = await page.request.post(`${ApiBase}/api/billing/checkout`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { url?: string };
    expect(body.url).toBeTruthy();
    expect(body.url).toMatch(/checkout\.stripe\.com/);
  });

  test('Perpetual license checkout returns Stripe URL', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + ADMIN_PASSWORD');
    const sessionCookie = await getSessionCookie(page);
    test.skip(!sessionCookie, 'No valid session — authentication failed');

    const response = await page.request.post(`${ApiBase}/api/billing/checkout-perpetual`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    // 200 = checkout created, 409 = already has perpetual license (both valid)
    expect([200, 409]).toContain(response.status());
    if (response.status() === 200) {
      const body = (await response.json()) as { url?: string };
      expect(body.url).toBeTruthy();
      expect(body.url).toMatch(/checkout\.stripe\.com/);
    }
  });

  test('Credits checkout returns Stripe URL', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + ADMIN_PASSWORD');
    const sessionCookie = await getSessionCookie(page);
    test.skip(!sessionCookie, 'No valid session — authentication failed');

    const response = await page.request.post(`${ApiBase}/api/billing/checkout-credits`, {
      data: { bundle: 'starter' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { url?: string };
    expect(body.url).toBeTruthy();
    expect(body.url).toMatch(/checkout\.stripe\.com/);
  });

  test('Billing portal returns Stripe URL', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + ADMIN_PASSWORD');
    const sessionCookie = await getSessionCookie(page);
    test.skip(!sessionCookie, 'No valid session — authentication failed');

    const response = await page.request.post(`${ApiBase}/api/billing/portal`, {
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    // Portal requires an active Stripe customer — may return 400 for free-tier users
    // with no Stripe customer record. Both 200 and 400 are valid outcomes.
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const body = (await response.json()) as { url?: string };
      expect(body.url).toBeTruthy();
      expect(body.url).toMatch(/billing\.stripe\.com/);
    }
  });

  test('RVUI payment returns 501 (disabled)', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + ADMIN_PASSWORD');
    const sessionCookie = await getSessionCookie(page);
    test.skip(!sessionCookie, 'No valid session — authentication failed');

    const response = await page.request.post(`${ApiBase}/api/billing/rvui-payment`, {
      data: {
        txSignature: 'test_sig_placeholder',
        tier: 'Pro',
        walletAddress: 'test_wallet_placeholder',
        network: 'devnet',
      },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    expect(response.status()).toBe(501);
    const body = (await response.json()) as { success: boolean; message: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain('not yet available');
  });

  // ─── Full browser checkout flow ────────────────────────────────────────────

  test('Full subscription checkout with test card', async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(
      !(hasCredentials && hasStripeKey),
      'Requires Admin credentials and STRIPE_SECRET_KEY=sk_test_...',
    );
    const sessionCookie = await getSessionCookie(page);
    test.skip(!sessionCookie, 'No valid session — authentication failed');

    // 1. Create checkout session via API
    const checkoutRes = await page.request.post(`${ApiBase}/api/billing/checkout`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });
    expect(checkoutRes.ok()).toBe(true);
    const { url: stripeUrl } = (await checkoutRes.json()) as { url: string };
    expect(stripeUrl).toContain('checkout.stripe.com');

    // 2. Navigate to Stripe hosted checkout
    await page.goto(stripeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(page.url()).toContain('checkout.stripe.com');

    // 3. Fill email (may be pre-filled from Stripe customer)
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first();
    if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const currentValue = await emailInput.inputValue();
      if (!currentValue) await emailInput.fill('smoke-test@example.com');
    }

    // 4. Fill card details — Stripe renders card fields in iframes
    const cardInputSelector =
      'input[name="number"], input[data-field="cardNumber"], input[placeholder*="1234"]';

    // Try the Stripe elements iframe selector, then fall back to private frame name
    let cardFrameLocator = page.frameLocator('iframe[src*="js.stripe.com/v3/elements"]').first();
    let hasCardFrame = await cardFrameLocator
      .locator(cardInputSelector)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (!hasCardFrame) {
      cardFrameLocator = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
      hasCardFrame = await cardFrameLocator
        .locator(cardInputSelector)
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
    }

    // Stripe UI changed or test environment can't reach Stripe — skip gracefully
    test.skip(!hasCardFrame, 'Stripe card iframe not found — UI may have changed');

    // Card number
    const cardNumber = cardFrameLocator.locator(cardInputSelector);
    await cardNumber.fill('4242424242424242');

    // Expiry
    await cardFrameLocator
      .locator('input[name="expiry"], input[data-field="cardExpiry"], input[placeholder*="MM"]')
      .fill('1230');

    // CVC
    await cardFrameLocator
      .locator('input[name="cvc"], input[data-field="cardCvc"], input[placeholder*="CVC"]')
      .fill('123');

    // 5. Fill billing name if visible
    const nameInput = page.locator('input[name="name"], input[autocomplete="name"]').first();
    if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const name = await nameInput.inputValue();
      if (!name) await nameInput.fill('Test User');
    }

    // 6. Fill ZIP/postal if visible
    const zipInput = page
      .locator('input[name="postal"], input[autocomplete="postal-code"], input[name="zip"]')
      .first();
    if (await zipInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const zip = await zipInput.inputValue();
      if (!zip) await zipInput.fill('10001');
    }

    // 7. Click Pay/Subscribe
    const submitBtn = page.getByRole('button', { name: /subscribe|pay|start trial/i }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // 8. Wait for redirect to admin billing page
    await page.waitForURL(`${CmsBase}/account/billing**`, { timeout: 30_000 });
    expect(page.url()).toContain('/account/billing');
    expect(page.url()).toContain('success=true');
  });
});
