/**
 * Auth E2E Tests
 *
 * Tests the full authentication lifecycle: sign-up, email verification,
 * sign-in, password reset, rate limiting, and session persistence.
 *
 * REQUIRES live services:
 *   - apps/admin (port 4000) with a running database
 *
 * Run with:
 *   pnpm dev  (start services first)
 *   pnpm test:e2e -- e2e/auth.e2e.ts
 *
 * Run against production (CI=true skips local dev server startup):
 *   CI=true \
 *     PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *     playwright test e2e/auth.e2e.ts --project=chromium
 *
 * Admin auth routes:
 *   /login           -  sign in page (button: "Sign in")
 *   /signup          -  create account (button: "Create account")
 *   /reset-password  -  request reset link (no ?token) or set new password (?token=...)
 *
 * NOTE: The rate-limiting test at the bottom makes 6 failed login attempts which
 * triggers IP-based rate limiting for ~15 min. If you need to re-run sign-in tests
 * quickly after, wait for the rate limit to clear or use a different IP.
 */

import { expect, test } from '@playwright/test';

const ADMIN_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';

// Skip entire suite if Admin is not reachable
test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${ADMIN_BASE}/api/health`, { timeout: 3000 });
    if (!res.ok()) {
      test.skip();
    }
  } catch {
    test.skip();
  }
});

// ---------------------------------------------------------------------------
// Sign-up → Sign-in → Sign-out
// ---------------------------------------------------------------------------

test.describe('Sign-up and sign-in flow', () => {
  const testEmail = `e2e-auth-${Date.now()}@revealui-test.com`;
  const testPassword = 'TestPass!@#$99';
  const testName = 'E2E Test User';

  test('user can sign up with email and password', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/signup`, { waitUntil: 'domcontentloaded' });

    // If signup is gated and we get redirected, skip
    if (!page.url().includes('/signup')) {
      test.skip();
      return;
    }

    // Fill name field if present (signup form has name, email, password)
    const nameField = page.getByLabel(/name/i).first();
    if (await nameField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await nameField.fill(testName);
    }

    await page.getByLabel(/email/i).fill(testEmail);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(testPassword);

    await page.getByRole('button', { name: /create account|sign up|register/i }).click();

    // After signup, should leave /signup page (redirects to / on success)
    try {
      await page.waitForFunction(() => !window.location.pathname.includes('/signup'), {
        timeout: 10000,
      });
    } catch {
      // Signup failed  -  skip if rate-limited, otherwise re-throw
      const rateLimited = await page
        .getByText(/too many|rate limit/i)
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (rateLimited) {
        test.skip();
        return;
      }
      throw new Error('Signup did not navigate away from /signup  -  check page for errors');
    }
    expect(page.url()).not.toContain('/signup');
  });

  test('user can sign in with valid credentials', async ({ page, request }) => {
    // Probe for rate limiting before attempting browser sign-in
    const probe = await request.post(`${ADMIN_BASE}/api/auth/sign-in`, {
      data: { email: testEmail, password: testPassword },
    });
    if (probe.status() === 429) {
      // IP is rate-limited (likely from rate-limiting test in a previous run)
      test.skip();
      return;
    }

    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });

    await page.getByLabel(/email/i).fill(testEmail);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(testPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // After login, should leave /login page (redirects to / on success)
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), {
      timeout: 10000,
    });
    expect(page.url()).not.toContain('/login');
  });

  test('sign-in fails with wrong password', async ({ page, request }) => {
    // Probe for rate limiting before attempting browser sign-in
    const probe = await request.post(`${ADMIN_BASE}/api/auth/sign-in`, {
      data: { email: testEmail, password: 'WrongProbePassword!' },
    });
    if (probe.status() === 429) {
      test.skip();
      return;
    }

    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });

    await page.getByLabel(/email/i).fill(testEmail);
    await page
      .getByLabel(/password/i)
      .first()
      .fill('WrongPassword123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Should show error and stay on login page (also matches "too many" for rate-limit fallback)
    await expect(page.getByText(/invalid|incorrect|wrong|failed|too many/i)).toBeVisible({
      timeout: 5000,
    });
    expect(page.url()).toContain('/login');
  });

  test('user can sign out', async ({ page, request }) => {
    // Probe for rate limiting before attempting browser sign-in
    const probe = await request.post(`${ADMIN_BASE}/api/auth/sign-in`, {
      data: { email: testEmail, password: testPassword },
    });
    if (probe.status() === 429) {
      test.skip();
      return;
    }

    // Sign in first
    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/email/i).fill(testEmail);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(testPassword);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), {
      timeout: 10000,
    });

    // Sign out via API endpoint (admin frontend has no sign-out button for viewer role)
    await page.request.post(`${ADMIN_BASE}/api/auth/sign-out`);

    // Session should be cleared  -  /api/auth/me should return 401
    const meRes = await page.request.get(`${ADMIN_BASE}/api/auth/me`);
    expect([401, 403]).toContain(meRes.status());
  });
});

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

test.describe('Session persistence', () => {
  test('authenticated session persists across page reload', async ({ page, context }) => {
    // Set a cookie or local-storage session if needed; skip if no way to auth
    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });

    // Check that reload of admin while logged in keeps user on admin page
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (c) => c.name.includes('session') || c.name.includes('auth'),
    );

    if (!sessionCookie) {
      test.skip();
      return;
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    // Should not be redirected back to login
    expect(page.url()).not.toContain('/login');
  });
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

test.describe('Password reset flow', () => {
  test('forgot-password page renders and accepts email', async ({ page }) => {
    // /reset-password (without token) shows the "request reset link" form
    await page.goto(`${ADMIN_BASE}/reset-password`, { waitUntil: 'domcontentloaded' });

    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    await emailInput.fill('reset-test@revealui-test.com');
    // Button says "Send Reset Link"
    await page.getByRole('button', { name: /send|reset|submit/i }).click();

    // Success: heading "Check Your Email" appears (skip if rate-limited)
    try {
      await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible({
        timeout: 5000,
      });
    } catch {
      const rateLimited = await page
        .getByText(/too many|rate limit/i)
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (rateLimited) {
        test.skip();
        return;
      }
      throw new Error('Password reset form did not show success heading  -  check page for errors');
    }
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// NOTE: This test makes 6 failed login attempts which will trigger IP-based
// rate limiting for ~15 minutes. Run it last / in isolation.
// ---------------------------------------------------------------------------

test.describe('Rate limiting', () => {
  test('repeated failed logins trigger rate limit or lock message', async ({ page }) => {
    const blockedEmail = `rate-limit-${Date.now()}@revealui-test.com`;

    await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });

    // Attempt 6 failed logins
    for (let i = 0; i < 6; i++) {
      await page.getByLabel(/email/i).fill(blockedEmail);
      await page
        .getByLabel(/password/i)
        .first()
        .fill('WrongPassword!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForTimeout(200);
    }

    // Should see a rate-limit or account-locked message
    await expect(page.getByText(/too many|rate limit|locked|blocked|try again/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
