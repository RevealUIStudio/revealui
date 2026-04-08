/**
 * Billing Funnel E2E Tests
 *
 * Covers the full RevealUI subscription pipeline:
 *   billing page auth gate → free-tier upgrade CTA → Stripe checkout →
 *   license generation (via webhook) → feature access verification →
 *   Pro → Enterprise in-place upgrade
 *
 * ─── REQUIRED ENV VARS ────────────────────────────────────────────────────────
 *   PLAYWRIGHT_BASE_URL   https://admin.revealui.com
 *   API_BASE_URL          https://api.revealui.com
 *   CMS_ADMIN_EMAIL       admin@example.com
 *   CMS_ADMIN_PASSWORD    <your-cms-admin-password>
 *
 * ─── REQUIRED FOR STRIPE CHECKOUT TESTS ─────────────────────────────────────
 *   STRIPE_SECRET_KEY     sk_test_...  (Stripe test key — not charged)
 *
 * ─── REQUIRED FOR PRICE ID TESTS ────────────────────────────────────────────
 *   STRIPE_PRO_PRICE_ID       price_... (your Stripe test Pro price ID)
 *   STRIPE_ENTERPRISE_PRICE_ID price_... (your Stripe test Enterprise price ID)
 *
 * Stripe test card: 4242 4242 4242 4242 | exp 12/30 | CVC 123
 *
 * Run (full suite):
 *   CI=1 \
 *   PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *   API_BASE_URL=https://api.revealui.com \
 *   CMS_ADMIN_EMAIL=admin@example.com \
 *   CMS_ADMIN_PASSWORD='<your-cms-admin-password>' \
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   node_modules/.bin/playwright test e2e/billing-funnel.e2e.ts \
 *     --project=chromium --retries=0 --reporter=line
 *
 * Run (auth + UI only — no Stripe key required):
 *   PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *   CMS_ADMIN_EMAIL=admin@example.com \
 *   CMS_ADMIN_PASSWORD='<your-cms-admin-password>' \
 *   node_modules/.bin/playwright test e2e/billing-funnel.e2e.ts \
 *     --project=chromium --retries=0
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

// Absolute path to the auth state file — works regardless of CWD
const AUTH_STATE_PATH = join(import.meta.dirname, '.auth', 'user.json');

// ─── Config ──────────────────────────────────────────────────────────────────

const CMS_BASE = (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE_URL || 'http://localhost:3004').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const ENTERPRISE_PRICE_ID = process.env.STRIPE_ENTERPRISE_PRICE_ID;

const hasCredentials = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;
const hasStripeKey = STRIPE_KEY.startsWith('sk_test_');

// ─── Session cache ────────────────────────────────────────────────────────────

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
  /** "name=value" cookie string for manual cross-domain API headers */
  cookieHeader: string;
  /** Parsed cookie object for page.context().addCookies() */
  cookie: PlaywrightCookie;
  tier: string | null;
}

/**
 * Module-level session cache. Populated once per test run.
 *
 * Strategy (in priority order):
 *  1. Return cached session from this run (zero network calls for subsequent tests)
 *  2. Try saved cookies from global-setup's e2e/.auth/user.json
 *     — validate against the billing API; use if valid
 *  3. Fall back to a fresh API sign-in (done at most ONCE per run)
 *
 * This means the rate-limit endpoint is hit at most once per `playwright test`
 * invocation, regardless of how many tests call signIn / signInViaApi.
 */
let _session: SessionCache | null | undefined; // undefined = not yet resolved

/**
 * Establish a session for the given page.
 *
 * Priority:
 *  1. Module-level cache — zero network calls for subsequent tests
 *  2. Saved auth state from global-setup (e2e/.auth/user.json)
 *  3. Fresh API sign-in — last resort (rate-limited in production)
 *
 * Cookie domain is forced to admin.revealui.com regardless of what the saved
 * state says. This prevents Playwright from automatically sending the cookie
 * to api.revealui.com requests, which would conflict with the manual cookie
 * headers used in API test assertions.
 */
async function ensureSession(page: Page): Promise<SessionCache | null> {
  if (_session !== undefined) {
    // Restore cached cookie into this test's browser context (no network call)
    if (_session) await page.context().addCookies([_session.cookie]);
    return _session;
  }

  // ── 1. Try saved auth state from global-setup ──────────────────────────────
  try {
    const raw = await readFile(AUTH_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { cookies?: { name: string; value: string }[] };
    if (Array.isArray(parsed?.cookies) && parsed.cookies.length > 0) {
      const saved = parsed.cookies[0];
      const cookieHeader = `${saved.name}=${saved.value}`;

      const checkRes = await page.request.get(`${API_BASE}/api/billing/subscription`, {
        headers: { cookie: cookieHeader },
      });

      if (checkRes.ok()) {
        // Use the wildcard parent domain (.revealui.com) so the browser sends the
        // cookie to both admin.revealui.com and api.revealui.com. This allows the
        // billing page's in-page fetch(api.revealui.com, { credentials: 'include' })
        // to authenticate correctly. page.request.* calls use a separate APIRequestContext
        // that ignores browser cookies, so there is no conflict with manual headers.
        const cookie: PlaywrightCookie = {
          name: saved.name,
          value: saved.value,
          domain: new URL(CMS_BASE).hostname.replace(/^[^.]+\./, '.'), // '.revealui.com'
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: CMS_BASE.startsWith('https'),
          sameSite: 'Lax',
        };
        await page.context().addCookies([cookie]);
        const tier = ((await checkRes.json()) as { tier: string }).tier;
        _session = { cookieHeader, cookie, tier };
        return _session;
      }
      // Saved cookies are stale — fall through to fresh sign-in
    }
  } catch {
    // Auth state file missing or invalid — fall through to fresh sign-in
  }

  // ── 2. Fresh sign-in (at most once per run) ────────────────────────────────
  const res = await page.request.post(`${CMS_BASE}/api/auth/sign-in`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    _session = null;
    return null;
  }

  // page.request.post stores the response cookie in the browser context
  const contextCookies = await page.context().cookies(CMS_BASE);
  const rawCookie = contextCookies[0];
  if (!rawCookie) {
    _session = null;
    return null;
  }

  const cookie: PlaywrightCookie = {
    ...rawCookie,
    // Wildcard parent domain so in-page fetch to api.revealui.com also gets the cookie.
    // page.request.* uses a separate APIRequestContext so no conflict with manual headers.
    domain: new URL(CMS_BASE).hostname.replace(/^[^.]+\./, '.'), // '.revealui.com'
  };
  const cookieHeader = `${cookie.name}=${cookie.value}`;

  const tierRes = await page.request.get(`${API_BASE}/api/billing/subscription`, {
    headers: { cookie: cookieHeader },
  });
  const tier = tierRes.ok() ? ((await tierRes.json()) as { tier: string }).tier : null;

  _session = { cookieHeader, cookie, tier };
  return _session;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Authenticate the page. Uses cached session — no sign-in if already done this run. */
async function signIn(page: Page): Promise<void> {
  const session = await ensureSession(page);
  if (!session) throw new Error('signIn: authentication failed (rate-limited or no valid session)');
}

/**
 * Authenticate and return (sessionCookie, tier) for direct API calls.
 * Uses cached session — at most one sign-in attempt per test run.
 */
async function signInViaApi(
  page: Page,
): Promise<{ sessionCookie: string | null; tier: string | null }> {
  const session = await ensureSession(page);
  if (!session) return { sessionCookie: null, tier: null };
  return { sessionCookie: session.cookieHeader, tier: session.tier };
}

// ─── Auth gate ────────────────────────────────────────────────────────────────

test.describe('Billing page — auth gate', () => {
  test('redirects to /login when not authenticated', async ({ page }) => {
    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    // Next.js client redirect — wait for URL to change
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    expect(page.url()).toContain('/login');
  });
});

// ─── Free tier UI ─────────────────────────────────────────────────────────────

test.describe('Billing page — free tier', () => {
  test.beforeEach(async () => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD');
  });

  test('shows plan badge and upgrade CTA', async ({ page }) => {
    await signIn(page);
    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/current plan/i)).toBeVisible({ timeout: 8_000 });
    // Should show either Free badge or a subscription badge
    await expect(page.getByText(/free|pro|enterprise/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('free-tier user sees Upgrade to Pro button', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier !== 'free', 'Skipped: user is not free tier');

    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('pro-tier user sees Upgrade to Enterprise and Manage Billing buttons', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier !== 'pro', 'Skipped: user is not pro tier');

    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /upgrade to enterprise/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole('button', { name: /manage billing/i })).toBeVisible({
      timeout: 8_000,
    });
  });

  test('enterprise-tier user sees only Manage Billing button', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier !== 'enterprise', 'Skipped: user is not enterprise tier');

    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /manage billing/i })).toBeVisible({
      timeout: 8_000,
    });
    await expect(page.getByRole('button', { name: /upgrade to enterprise/i })).not.toBeVisible();
  });
});

// ─── Checkout redirect ─────────────────────────────────────────────────────────

test.describe('Billing page — checkout redirect', () => {
  test.beforeEach(async () => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD');
  });

  test('POST /api/billing/checkout returns a Stripe URL', async ({ page }) => {
    const { sessionCookie, tier } = await signInViaApi(page);
    test.skip(!sessionCookie || tier !== 'free', 'Skipped: not free tier or no session');

    const res = await page.request.post(`${API_BASE}/api/billing/checkout`, {
      data: { priceId: PRO_PRICE_ID, tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { url?: string };
    expect(body.url).toBeTruthy();
    expect(body.url).toMatch(/checkout\.stripe\.com/);
  });

  test('?upgrade=pro triggers auto-redirect to Stripe when free tier', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier !== 'free', 'Skipped: user is not free tier');

    const navigationPromise = page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    await page.goto(`${CMS_BASE}/account/billing?upgrade=pro`, { waitUntil: 'domcontentloaded' });
    await navigationPromise;
    expect(page.url()).toContain('checkout.stripe.com');
  });
});

// ─── Success banner (no Stripe key needed) ────────────────────────────────────

test.describe('Billing page — success banner', () => {
  test.beforeEach(async () => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD');
  });

  test('billing page shows activation success banner after checkout', async ({ page }) => {
    // Verifies the ?success=true query param produces the correct UI.
    // Does not require a Stripe key — just navigates to the billing page with the param.
    await signIn(page);
    await page.goto(`${CMS_BASE}/account/billing?success=true`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/subscription activated|pro features are now available/i),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Stripe checkout (test-mode only) ─────────────────────────────────────────

test.describe('Stripe checkout — test mode', () => {
  // These tests navigate to Stripe's hosted checkout page and fill in a test card.
  // They only run when STRIPE_SECRET_KEY=sk_test_... is configured AND the account
  // is on the free tier (so a checkout URL can be obtained).

  test.beforeEach(async () => {
    test.skip(
      !(hasCredentials && hasStripeKey),
      'Requires CMS credentials and STRIPE_SECRET_KEY=sk_test_...',
    );
  });

  test('can complete checkout with Stripe test card and return to billing page', async ({
    page,
  }) => {
    const { sessionCookie, tier } = await signInViaApi(page);
    test.skip(!sessionCookie || tier !== 'free', 'Skipped: not free tier or no session');

    // Obtain checkout URL via API (avoids UI timing issues)
    const checkoutRes = await page.request.post(`${API_BASE}/api/billing/checkout`, {
      data: { priceId: PRO_PRICE_ID, tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });
    expect(checkoutRes.ok()).toBe(true);
    const { url: checkoutUrl } = (await checkoutRes.json()) as { url: string };

    // Navigate to Stripe hosted checkout
    await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(page.url()).toContain('checkout.stripe.com');

    // ── Email field (may be pre-filled from Stripe customer) ──
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first();
    if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const currentValue = await emailInput.inputValue();
      if (!currentValue) await emailInput.fill(ADMIN_EMAIL);
    }

    // ── Card details — Stripe Payment Element (iframe) ──
    // Stripe renders card fields inside an iframe on their own checkout page.
    // Try the Stripe elements iframe selector; fall back to the private frame name.
    const cardInputSelector =
      'input[name="number"], input[data-field="cardNumber"], input[placeholder*="1234"]';

    // Probe first selector, then fall back
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

    const cardNumber = cardFrameLocator.locator(cardInputSelector);
    await cardNumber.fill('4242424242424242');
    await cardFrameLocator
      .locator('input[name="expiry"], input[data-field="cardExpiry"], input[placeholder*="MM"]')
      .fill('1230');
    await cardFrameLocator
      .locator('input[name="cvc"], input[data-field="cardCvc"], input[placeholder*="CVC"]')
      .fill('123');

    // ── Billing address (required — billing_address_collection: 'required') ──
    // Stripe auto-fills name/address from customer record in some cases.
    const nameInput = page.locator('input[name="name"], input[autocomplete="name"]').first();
    if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const name = await nameInput.inputValue();
      if (!name) await nameInput.fill('RevealUI Test');
    }

    // Address line 1
    const addressInput = page
      .locator('input[name="address"], input[autocomplete="address-line1"]')
      .first();
    if (await addressInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const addr = await addressInput.inputValue();
      if (!addr) await addressInput.fill('123 Test St');
    }

    // ZIP / postal code
    const zipInput = page
      .locator('input[name="postal"], input[autocomplete="postal-code"], input[name="zip"]')
      .first();
    if (await zipInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const zip = await zipInput.inputValue();
      if (!zip) await zipInput.fill('10001');
    }

    // ── Submit ──
    const submitBtn = page.getByRole('button', { name: /subscribe|pay|start trial/i }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // ── Wait for redirect back to billing page ──
    await page.waitForURL(`${CMS_BASE}/account/billing**`, { timeout: 30_000 });
    expect(page.url()).toContain('/account/billing');
    expect(page.url()).toContain('success=true');
  });
});

// ─── License + feature access verification ────────────────────────────────────

test.describe('License verification', () => {
  test.beforeEach(async () => {
    test.skip(!hasCredentials, 'Requires CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD');
  });

  test('GET /api/billing/subscription returns a valid tier and status', async ({ page }) => {
    const { sessionCookie } = await signInViaApi(page);
    test.skip(!sessionCookie, 'Skipped: no valid session');

    const res = await page.request.get(`${API_BASE}/api/billing/subscription`, {
      headers: { cookie: sessionCookie?.split(';')[0] },
    });

    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { tier: string; status: string; licenseKey: string | null };
    expect(['free', 'pro', 'enterprise']).toContain(body.tier);
    expect(body.status).toBeTruthy();
  });

  test('pro/enterprise user has a license key', async ({ page }) => {
    const { sessionCookie, tier } = await signInViaApi(page);
    test.skip(!sessionCookie || tier === 'free', 'Skipped: free tier has no license key');

    const res = await page.request.get(`${API_BASE}/api/billing/subscription`, {
      headers: { cookie: sessionCookie?.split(';')[0] },
    });

    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { licenseKey: string | null };
    expect(body.licenseKey).toBeTruthy();
    // License key is a signed JWT (eyJ...) or a legacy rv- prefixed key
    expect(body.licenseKey).toMatch(/^rv-|^eyJ/);
  });

  test('monitoring page is accessible to pro/enterprise users', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier === 'free' || !tier, 'Skipped: free tier does not have monitoring access');

    await page.goto(`${CMS_BASE}/admin/monitoring`, { waitUntil: 'domcontentloaded' });

    // Should NOT show the UpgradePrompt — should show actual monitoring content
    await expect(page.getByText(/upgrade|requires pro/i)).not.toBeVisible({ timeout: 5_000 });
  });
});

// ─── Pro → Enterprise upgrade ─────────────────────────────────────────────────

test.describe('Pro → Enterprise upgrade', () => {
  test.beforeEach(async () => {
    // Requires a Stripe test key to avoid triggering real Stripe API calls in production.
    test.skip(
      !(hasCredentials && hasStripeKey),
      'Requires CMS credentials and STRIPE_SECRET_KEY=sk_test_...',
    );
  });

  test('POST /api/billing/upgrade returns success for pro-tier user', async ({ page }) => {
    const { sessionCookie, tier } = await signInViaApi(page);
    test.skip(!sessionCookie || tier !== 'pro', 'Skipped: user is not pro tier');

    const res = await page.request.post(`${API_BASE}/api/billing/upgrade`, {
      data: { priceId: ENTERPRISE_PRICE_ID, targetTier: 'enterprise' },
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie?.split(';')[0],
      },
    });

    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { success: boolean; subscriptionId: string };
    expect(body.success).toBe(true);
    expect(body.subscriptionId).toMatch(/^sub_/);
  });

  test('Upgrade to Enterprise button shows success banner', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier !== 'pro', 'Skipped: user is not pro tier');

    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /upgrade to enterprise/i })).toBeVisible({
      timeout: 8_000,
    });

    await page.getByRole('button', { name: /upgrade to enterprise/i }).click();

    await expect(page.getByText(/upgraded to enterprise|upgrading/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('upgrade banner shows after successful in-place upgrade', async ({ page }) => {
    const { tier } = await signInViaApi(page);
    test.skip(tier !== 'pro', 'Skipped: user is not pro tier');

    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });

    // Wait for billing data to load
    await expect(page.getByText(/pro/i).first()).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /upgrade to enterprise/i }).click();

    // Success banner should appear within a few seconds
    await expect(page.getByText(/upgraded to enterprise/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Billing portal ───────────────────────────────────────────────────────────

test.describe('Billing portal', () => {
  test.beforeEach(async () => {
    test.skip(
      !(hasCredentials && hasStripeKey),
      'Requires CMS credentials and STRIPE_SECRET_KEY=sk_test_...',
    );
  });

  test('Manage Billing button opens Stripe billing portal', async ({ page }) => {
    // beforeEach skip is unreliable in Playwright v1.58 async beforeEach — guard here too
    test.skip(!hasStripeKey, 'Requires STRIPE_SECRET_KEY=sk_test_...');
    const { tier } = await signInViaApi(page);
    test.skip(!tier || tier === 'free', 'Skipped: free tier has no billing portal');

    await page.goto(`${CMS_BASE}/account/billing`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /manage billing/i })).toBeVisible({
      timeout: 8_000,
    });

    const navigationPromise = page.waitForURL(/billing\.stripe\.com/, { timeout: 15_000 });
    await page.getByRole('button', { name: /manage billing/i }).click();
    await navigationPromise;
    expect(page.url()).toContain('billing.stripe.com');
  });
});
