/**
 * Billing Checkout E2E Tests
 *
 * Playwright tests that automate the full Stripe checkout flow:
 *   API checkout session creation → Stripe hosted checkout → redirect verification
 *
 * ─── PREREQUISITES ──────────────────────────────────────────────────────────────
 *   1. API (apps/server) and Admin (apps/admin) must be running
 *   2. Stripe test mode keys configured (sk_test_...)
 *   3. Authenticated user session (ADMIN_EMAIL + ADMIN_PASSWORD)
 *
 * ─── REQUIRED ENV VARS ──────────────────────────────────────────────────────────
 *   STRIPE_SECRET_KEY        sk_test_... (Stripe test key  -  never charged)
 *   ADMIN_EMAIL          admin@example.com
 *   ADMIN_PASSWORD       <your-admin-password>
 *
 * ─── OPTIONAL ENV VARS ──────────────────────────────────────────────────────────
 *   API_BASE_URL             defaults to http://localhost:3004
 *   PLAYWRIGHT_BASE_URL      defaults to http://localhost:4000
 *
 * Stripe test card: 4242 4242 4242 4242 | exp 12/30 | CVC 123
 *
 * ─── AUTH MODEL (why this file looks the way it does) ────────────────────────────
 *   Sign-in sets THREE cookies; the API authenticates on `revealui-session` (NOT
 *   the first Set-Cookie, which is `revealui-role`). State-changing POSTs are also
 *   CSRF-protected: the API requires an `X-CSRF-Token` header validated (HMAC
 *   double-submit) against the session cookie. The token lives in the non-httpOnly
 *   `revealui-csrf` cookie, which the admin proxy mints on any authenticated admin
 *   response (NOT on sign-in itself). So we sign in, hit an admin page to mint the
 *   CSRF cookie, then send both the session cookie and the decoded CSRF token.
 *
 * Run:
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   ADMIN_EMAIL=admin@example.com \
 *   ADMIN_PASSWORD='...' \
 *   pnpm test:e2e -- --project=chromium e2e/billing-checkout.e2e.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type APIResponse, expect, type Page, test } from '@playwright/test';

// ─── Config ──────────────────────────────────────────────────────────────────

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** `admin.revealui.com` -> `.revealui.com` so the cookie is sent cross-subdomain. */
function crossSubdomainDomain(hostname: string): string {
  const firstDot = hostname.indexOf('.');
  return firstDot === -1 ? hostname : hostname.substring(firstDot);
}

const ApiBase = stripTrailingSlash(process.env.API_BASE_URL || 'http://localhost:3004');
const AdminBase = stripTrailingSlash(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';

const hasCredentials = !!ADMIN_EMAIL && !!ADMIN_PASSWORD;
const hasStripeKey = STRIPE_KEY.startsWith('sk_test_');

const SESSION_COOKIE_NAME = 'revealui-session';
const CSRF_COOKIE_NAME = 'revealui-csrf';
const STRIPE_CHECKOUT_URL_PREFIX = 'https://checkout.stripe.com/';
const STRIPE_PORTAL_URL_FRAGMENT = 'billing.stripe.com';

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
  csrfToken: string;
}

let _session: SessionCache | null | undefined;

/**
 * Mint and read the CSRF token. The admin proxy sets the non-httpOnly
 * `revealui-csrf` cookie on any authenticated admin response, so hit an admin
 * page (with the session cookie already in the context jar) and then read it.
 * The cookie value is URL-encoded (`:` -> `%3A`); decode it to match the token
 * the browser's `apiFetch` sends in the `X-CSRF-Token` header.
 */
async function mintCsrfToken(page: Page): Promise<string> {
  await page.request.get(`${AdminBase}/account/billing`).catch(() => undefined);
  const cookies = await page.context().cookies(AdminBase);
  const csrf = cookies.find((c) => c.name === CSRF_COOKIE_NAME);
  return csrf ? decodeURIComponent(csrf.value) : '';
}

/**
 * Ensure an authenticated session exists. Uses the saved auth state from
 * global-setup, validates it, then falls back to a fresh API sign-in. Selects
 * the `revealui-session` cookie by name (NOT index 0) and mints a CSRF token.
 * Caches the result for the entire test run (at most one sign-in).
 */
async function ensureSession(page: Page): Promise<SessionCache | null> {
  if (_session !== undefined) {
    if (_session) await page.context().addCookies([_session.cookie]);
    return _session;
  }

  // Try saved auth state from global-setup (find the session cookie by name).
  try {
    const raw = await readFile(AUTH_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { cookies?: PlaywrightCookie[] };
    const savedCookies = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
    const savedSession = savedCookies.find((c) => c.name === SESSION_COOKIE_NAME);

    if (savedSession) {
      const cookieHeader = `${savedSession.name}=${savedSession.value}`;

      // Validate the cookie against the API
      const checkRes = await page.request.get(`${ApiBase}/api/billing/subscription`, {
        headers: { cookie: cookieHeader },
      });

      if (checkRes.ok()) {
        const cookie: PlaywrightCookie = {
          name: savedSession.name,
          value: savedSession.value,
          domain: crossSubdomainDomain(new URL(AdminBase).hostname),
          path: '/',
          expires: savedSession.expires ?? -1,
          httpOnly: true,
          secure: AdminBase.startsWith('https'),
          sameSite: 'Lax',
        };
        await page.context().addCookies([cookie]);
        const csrfToken = await mintCsrfToken(page);
        _session = { cookieHeader, cookie, csrfToken };
        return _session;
      }
    }
  } catch {
    // Auth state file missing or invalid  -  fall through
  }

  // Fresh sign-in (at most once per run)
  const res = await page.request.post(`${AdminBase}/api/auth/sign-in`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    _session = null;
    return null;
  }

  // The sign-in response populates the context jar with all cookies; select the
  // session cookie by name (index 0 is `revealui-role`, not the session).
  const contextCookies = await page.context().cookies(AdminBase);
  const sessionCookie = contextCookies.find((c) => c.name === SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    _session = null;
    return null;
  }

  const cookie: PlaywrightCookie = {
    ...sessionCookie,
    domain: crossSubdomainDomain(new URL(AdminBase).hostname),
  };
  const cookieHeader = `${cookie.name}=${cookie.value}`;
  const csrfToken = await mintCsrfToken(page);

  _session = { cookieHeader, cookie, csrfToken };
  return _session;
}

/**
 * Assert a checkout endpoint is HEALTHY. Healthy means EITHER (a) HTTP 200 with a
 * real Stripe checkout URL (free-tier account), OR (b) a documented business
 * rejection — a 4xx with a JSON `error` (e.g. the account already has a
 * subscription). Both prove auth + CSRF + services resolved and the request
 * reached the billing handler. It is NOT healthy on 401/403 (auth/CSRF broke),
 * any 5xx (services missing / crash — the original outage), or a non-JSON body.
 */
async function expectHealthyCheckout(response: APIResponse): Promise<void> {
  const status = response.status();
  expect(status === 401 || status === 403, `auth/CSRF failure (HTTP ${status})`).toBe(false);
  expect(status < 500, `server error (HTTP ${status})`).toBe(true);

  const body = (await response.json()) as { url?: string; error?: string };

  if (status === 200) {
    expect(body.url, 'expected a checkout URL on HTTP 200').toBeTruthy();
    expect(body.url?.startsWith(STRIPE_CHECKOUT_URL_PREFIX)).toBe(true);
    return;
  }

  // 4xx: must be a real business rejection with a message, not a silent failure.
  expect(
    typeof body.error === 'string' && body.error.length > 0,
    `expected a business-rejection error message (HTTP ${status})`,
  ).toBe(true);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Billing Checkout E2E', { tag: '@billing' }, () => {
  // Skip entire suite if no Stripe key
  test.skip(!process.env.STRIPE_SECRET_KEY, 'Requires STRIPE_SECRET_KEY');

  // ─── API endpoint tests (verify checkout session creation) ─────────────────

  test('Subscription checkout (pro) is healthy', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires ADMIN_EMAIL + ADMIN_PASSWORD');
    const session = await ensureSession(page);
    test.skip(!session, 'No valid session  -  authentication failed');
    if (!session) return;

    const response = await page.request.post(`${ApiBase}/api/billing/checkout`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
      },
    });

    // Accept a Stripe URL (free-tier) OR an already-subscribed rejection.
    await expectHealthyCheckout(response);
  });

  test('Perpetual license checkout returns Stripe URL', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires ADMIN_EMAIL + ADMIN_PASSWORD');
    const session = await ensureSession(page);
    test.skip(!session, 'No valid session  -  authentication failed');
    if (!session) return;

    const response = await page.request.post(`${ApiBase}/api/billing/checkout-perpetual`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
      },
    });

    // 200 = checkout created, 409 = already has perpetual license (both valid)
    expect([200, 409]).toContain(response.status());
    if (response.status() === 200) {
      const body = (await response.json()) as { url?: string };
      expect(body.url).toBeTruthy();
      expect(body.url?.startsWith(STRIPE_CHECKOUT_URL_PREFIX)).toBe(true);
    }
  });

  test('Credits checkout is rejected', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires ADMIN_EMAIL + ADMIN_PASSWORD');
    const session = await ensureSession(page);
    test.skip(!session, 'No valid session  -  authentication failed');
    if (!session) return;

    const response = await page.request.post(`${ApiBase}/api/billing/checkout-credits`, {
      data: { bundle: 'starter' },
      headers: {
        'Content-Type': 'application/json',
        cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { url?: string; error?: string };
    expect(body.url).toBeUndefined();
    expect(body.error).toMatch(/not sold|not available/i);
  });

  test('Agency Perpetual leftover checkout is rejected', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires ADMIN_EMAIL + ADMIN_PASSWORD');
    const session = await ensureSession(page);
    test.skip(!session, 'No valid session  -  authentication failed');
    if (!session) return;

    const response = await page.request.post(`${ApiBase}/api/billing/checkout-perpetual`, {
      data: { tier: 'max' },
      headers: {
        'Content-Type': 'application/json',
        cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { url?: string; error?: string };
    expect(body.url).toBeUndefined();
    expect(body.error).toMatch(/not sold|sales/i);
  });

  test('Billing portal returns Stripe URL', async ({ page }) => {
    test.skip(!hasCredentials, 'Requires ADMIN_EMAIL + ADMIN_PASSWORD');
    const session = await ensureSession(page);
    test.skip(!session, 'No valid session  -  authentication failed');
    if (!session) return;

    const response = await page.request.post(`${ApiBase}/api/billing/portal`, {
      headers: {
        'Content-Type': 'application/json',
        cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
      },
    });

    // Portal requires an active Stripe customer  -  may return 400 for free-tier users
    // with no Stripe customer record. Both 200 and 400 are valid outcomes.
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      const body = (await response.json()) as { url?: string };
      expect(body.url).toBeTruthy();
      expect(body.url?.includes(STRIPE_PORTAL_URL_FRAGMENT)).toBe(true);
    }
  });

  // ─── Full browser checkout flow ────────────────────────────────────────────

  test('Full subscription checkout with test card', async ({ page }) => {
    test.setTimeout(60_000);
    test.skip(
      !(hasCredentials && hasStripeKey),
      'Requires Admin credentials and STRIPE_SECRET_KEY=sk_test_...',
    );
    const session = await ensureSession(page);
    test.skip(!session, 'No valid session  -  authentication failed');
    if (!session) return;

    // 1. Create checkout session via API
    const checkoutRes = await page.request.post(`${ApiBase}/api/billing/checkout`, {
      data: { tier: 'pro' },
      headers: {
        'Content-Type': 'application/json',
        cookie: session.cookieHeader,
        'X-CSRF-Token': session.csrfToken,
      },
    });

    // The full card flow needs a free-tier account. If this account already has a
    // subscription the API returns a business rejection (not a Stripe URL)  -  skip
    // rather than fail, since the API-level tests above already prove it's healthy.
    test.skip(
      checkoutRes.status() !== 200,
      `Checkout did not start (HTTP ${checkoutRes.status()})  -  full card flow requires a free-tier account`,
    );

    const { url: stripeUrl } = (await checkoutRes.json()) as { url: string };
    expect(stripeUrl.startsWith(STRIPE_CHECKOUT_URL_PREFIX)).toBe(true);

    // 2. Navigate to Stripe hosted checkout
    await page.goto(stripeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(page.url()).toContain('checkout.stripe.com');

    // 3. Fill email (may be pre-filled from Stripe customer)
    const emailInput = page.locator('input[type="email"], input[autocomplete="email"]').first();
    if (await emailInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const currentValue = await emailInput.inputValue();
      if (!currentValue) await emailInput.fill('smoke-test@example.com');
    }

    // 4. Fill card details  -  Stripe renders card fields in iframes
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

    // Stripe UI changed or test environment can't reach Stripe  -  skip gracefully
    test.skip(!hasCardFrame, 'Stripe card iframe not found  -  UI may have changed');

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
    // regex-ok: idiomatic Playwright getByRole name matcher (pre-existing); the
    // Stripe-hosted button label varies (Subscribe / Pay / Start trial).
    const submitBtn = page.getByRole('button', { name: /subscribe|pay|start trial/i }).first();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // 8. Wait for redirect to admin billing page
    await page.waitForURL(`${AdminBase}/account/billing**`, { timeout: 30_000 });
    expect(page.url()).toContain('/account/billing');
    expect(page.url()).toContain('success=true');
  });
});
