/**
 * E2E Smoke Tests
 *
 * Lightweight tests that run without live database or Stripe.
 * These verify the apps start and respond correctly.
 *
 * Run against local dev:
 *   pnpm test:e2e:smoke
 *
 * Run against production (CI=true skips local dev server startup):
 *   CI=true \
 *     API_BASE_URL=https://api.revealui.com \
 *     PLAYWRIGHT_BASE_URL=https://admin.revealui.com \
 *     MARKETING_BASE_URL=https://revealui.com \
 *     playwright test e2e/smoke.e2e.ts --project=chromium
 *
 * Production URLs (as of 2026-02-28):
 *   API:       https://api.revealui.com       (revealui-api Vercel project)
 *   Admin:     https://admin.revealui.com       (revealui-admin Vercel project)
 *   Marketing: https://revealui.com           (revealui-marketing Vercel project)
 *
 * No database, Stripe, or Supabase credentials required.
 */

import { expect, test } from '@playwright/test';
import { checkAccessibilityCritical } from './utils/a11y-helper';

// ---------------------------------------------------------------------------
// API Health Checks (apps/api — port 3004)
// ---------------------------------------------------------------------------

test.describe('API health', () => {
  const ApiBase = process.env.API_BASE_URL || 'http://localhost:3004';

  test('GET /health/live returns 200', async ({ request }) => {
    const response = await request.get(`${ApiBase}/health/live`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('status');
    const status = String(body.status).toLowerCase();
    expect(status === 'ok' || status === 'live' || status === 'healthy').toBe(true);
  });

  test('GET /health/ready returns 200 or 503', async ({ request }) => {
    // ready endpoint may return 503 if DB is not connected — that is acceptable
    // in a no-DB smoke test context. We only verify the server responds.
    const response = await request.get(`${ApiBase}/health/ready`);
    expect([200, 503]).toContain(response.status());
  });

  test('GET /openapi.json returns valid OpenAPI document', async ({ request }) => {
    const response = await request.get(`${ApiBase}/openapi.json`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('openapi');
    expect(body).toHaveProperty('info');
    expect(body).toHaveProperty('paths');
  });

  test('GET /docs returns Swagger UI HTML', async ({ request }) => {
    const response = await request.get(`${ApiBase}/docs`);
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('swagger');
  });
});

// ---------------------------------------------------------------------------
// Admin Basic Render (apps/admin — port 4000)
// ---------------------------------------------------------------------------

test.describe('Admin basic render', () => {
  const AdminBase = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';

  test('Admin root path responds', async ({ page }) => {
    // Soft-navigate — allow redirect to /admin or /login
    const response = await page.goto(AdminBase, { waitUntil: 'domcontentloaded' });
    // Any 2xx or 3xx (redirect to admin) is acceptable
    expect(response?.status()).toBeLessThan(500);
  });

  test('Admin panel loads without JS error', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto(`${AdminBase}/admin`, { waitUntil: 'domcontentloaded' });

    // Filter out known non-blocking warnings (HMR, Next dev overlay)
    const criticalErrors = jsErrors.filter(
      (e) =>
        !(
          e.includes('HMR') ||
          e.includes('webpack') ||
          e.includes('Next.js') ||
          e.includes('hydration')
        ),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('Admin root has no critical accessibility violations', async ({ page }) => {
    await page.goto(AdminBase, { waitUntil: 'domcontentloaded' });
    // Admin root may redirect to /admin or /login — wait for navigation to settle
    await page.waitForLoadState('networkidle');
    await checkAccessibilityCritical(page);
  });
});

// ---------------------------------------------------------------------------
// Marketing Page (apps/marketing — port 3002)
// ---------------------------------------------------------------------------

test.describe('Marketing page', () => {
  const MarketingBase = process.env.MARKETING_BASE_URL || 'http://localhost:3002';

  test('Marketing root responds', async ({ page }) => {
    const response = await page.goto(MarketingBase, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
  });

  test('Pricing page renders tier cards', async ({ page }) => {
    await page.goto(`${MarketingBase}/pricing`, { waitUntil: 'networkidle' });
    // Verify pricing tier headings (h3) are rendered in the DOM
    // regex-ok: Playwright locator filter requires regex for multi-value matching
    const tierHeadings = page.locator('h3').filter({ hasText: /^(Free|Pro|Max|Forge|Enterprise)/ });
    await expect(tierHeadings.first()).toBeAttached({ timeout: 10_000 });
    // At least 2 tiers should render (Free + at least one paid tier)
    const count = await tierHeadings.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('Waitlist POST returns success', async ({ request }) => {
    const response = await request.post(`${MarketingBase}/api/waitlist`, {
      data: { email: `smoke-test-${Date.now()}@example.com`, source: 'smoke-test' },
    });
    // 201 (new signup), 200 (duplicate), or 410 (waitlist closed post-launch)
    expect([200, 201, 410]).toContain(response.status());
    if (response.status() !== 410) {
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    }
  });

  test('Marketing homepage has no critical accessibility violations', async ({ page }) => {
    await page.goto(MarketingBase, { waitUntil: 'domcontentloaded' });
    await checkAccessibilityCritical(page);
  });
});
