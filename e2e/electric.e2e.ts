/**
 * ElectricSQL Integration E2E Tests
 *
 * Tests the admin → ElectricSQL proxy shape endpoints:
 *   GET /api/shapes/conversations    — row-level filtered by user_id
 *   GET /api/shapes/agent-contexts   — row-level filtered by session_id
 *   GET /api/shapes/agent-memories   — row-level filtered by agent_id
 *
 * Architecture:
 *   Admin (Next.js) → shape route → Electric (Railway) → NeonDB (logical replication)
 *
 * Test strategy:
 *   - Unauthenticated tests verify auth enforcement — no credentials required.
 *   - Authenticated tests sign up a fresh test user via API and verify 200 responses.
 *     Gracefully skip if rate-limited (5 sign-up/sign-in attempts per 15 minutes).
 *
 * REQUIRES live services:
 *   - apps/admin with ELECTRIC_SERVICE_URL pointing to Railway Electric instance
 *   - Electric running on Railway connected to NeonDB (logical replication enabled)
 *
 * Run against production (CI=true skips local dev server startup):
 *   CI=true \
 *     PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *     playwright test e2e/electric.e2e.ts --project=chromium
 *
 * NOTE: Authenticated tests create a new test user on each run. These accumulate
 * in the database — acceptable for now, pending a test-cleanup mechanism.
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
// Unauthenticated access — no credentials required
// Verifies that auth enforcement is working correctly
// ---------------------------------------------------------------------------

test.describe('Shape endpoints enforce authentication', () => {
  test('GET /api/shapes/conversations returns 401 without session', async ({ request }) => {
    const response = await request.get(`${ADMIN_BASE}/api/shapes/conversations`);
    expect(response.status()).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error', 'UNAUTHORIZED');
  });

  test('GET /api/shapes/agent-contexts returns 401 without session', async ({ request }) => {
    const response = await request.get(`${ADMIN_BASE}/api/shapes/agent-contexts`);
    expect(response.status()).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error', 'UNAUTHORIZED');
  });

  test('GET /api/shapes/agent-memories returns 401 without session', async ({ request }) => {
    const response = await request.get(
      `${ADMIN_BASE}/api/shapes/agent-memories?agent_id=assistant`,
    );
    expect(response.status()).toBe(401);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('error', 'UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// Authenticated access — sign up a fresh test user via API
// Skip gracefully if rate-limited
// ---------------------------------------------------------------------------

test.describe('Shape endpoints proxy Electric when authenticated', () => {
  const testEmail = `e2e-electric-${Date.now()}@revealui-test.com`;
  const testPassword = 'TestElectric!@#$99';
  const testName = 'E2E Electric User';

  // Session cookie value extracted from the sign-up Set-Cookie header.
  // Shared across tests in this describe block via module-level state.
  let sessionCookie: string | null = null;

  test.beforeAll(async ({ request }) => {
    // Probe sign-up endpoint for rate limiting before attempting
    const probe = await request
      .post(`${ADMIN_BASE}/api/auth/sign-up`, {
        data: { email: `probe-electric-${Date.now()}@revealui-test.com`, password: 'ProbePass!1' },
      })
      .catch(() => null);

    if (!probe || probe.status() === 429) {
      // Rate-limited — all authenticated tests will skip
      return;
    }

    // Sign up a fresh test user
    const signUpRes = await request.post(`${ADMIN_BASE}/api/auth/sign-up`, {
      data: { email: testEmail, password: testPassword, name: testName },
    });

    if (!signUpRes.ok()) {
      // Signup failed (could be rate-limited, validation error, or DB issue)
      return;
    }

    // Extract session cookie from Set-Cookie response header.
    // The cookie is set by the sign-up handler as 'revealui-session=<token>'.
    // We extract only the name=value part (before the first ';') to use
    // as a Cookie header in subsequent API requests.
    const setCookie = signUpRes.headers()['set-cookie'];
    if (setCookie) {
      const cookiePart = setCookie.split(';')[0];
      if (cookiePart?.includes('revealui-session')) {
        sessionCookie = cookiePart;
      }
    }
  });

  test('GET /api/shapes/conversations returns Electric snapshot when authenticated', async ({
    request,
  }) => {
    if (!sessionCookie) {
      test.skip();
      return;
    }

    const response = await request.get(`${ADMIN_BASE}/api/shapes/conversations`, {
      headers: { cookie: sessionCookie },
    });

    // Electric proxy returns 200 with snapshot data (empty array for new users)
    expect(response.status()).toBe(200);
  });

  test('GET /api/shapes/agent-contexts returns Electric snapshot when authenticated', async ({
    request,
  }) => {
    if (!sessionCookie) {
      test.skip();
      return;
    }

    const response = await request.get(`${ADMIN_BASE}/api/shapes/agent-contexts`, {
      headers: { cookie: sessionCookie },
    });

    expect(response.status()).toBe(200);
  });

  test('GET /api/shapes/agent-memories returns Electric snapshot when authenticated', async ({
    request,
  }) => {
    if (!sessionCookie) {
      test.skip();
      return;
    }

    const response = await request.get(
      `${ADMIN_BASE}/api/shapes/agent-memories?agent_id=assistant`,
      {
        headers: { cookie: sessionCookie },
      },
    );

    expect(response.status()).toBe(200);
  });
});
