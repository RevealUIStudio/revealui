/**
 * E2E Smoke Tests
 *
 * Lightweight tests that run without live database or Stripe.
 * These verify the apps start and respond correctly.
 *
 * Run with: pnpm test:e2e:smoke
 *
 * Services required:
 *   - apps/api (port 3004) — for health endpoint tests
 *   - apps/cms (port 4000) — for CMS render tests (optional, skipped if down)
 *   - apps/landing (port 3002) — for landing page tests (optional, skipped if down)
 *
 * No database, Stripe, or Supabase credentials required.
 */

import { expect, test } from '@playwright/test'

// ---------------------------------------------------------------------------
// API Health Checks (apps/api — port 3004)
// ---------------------------------------------------------------------------

test.describe('API health', () => {
  const ApiBase = process.env.API_BASE_URL || 'http://localhost:3004'

  test('GET /health/live returns 200', async ({ request }) => {
    const response = await request.get(`${ApiBase}/health/live`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toHaveProperty('status')
    expect(body.status).toMatch(/ok|live|healthy/i)
  })

  test('GET /health/ready returns 200 or 503', async ({ request }) => {
    // ready endpoint may return 503 if DB is not connected — that is acceptable
    // in a no-DB smoke test context. We only verify the server responds.
    const response = await request.get(`${ApiBase}/health/ready`)
    expect([200, 503]).toContain(response.status())
  })

  test('GET /openapi.json returns valid OpenAPI document', async ({ request }) => {
    const response = await request.get(`${ApiBase}/openapi.json`)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toHaveProperty('openapi')
    expect(body).toHaveProperty('info')
    expect(body).toHaveProperty('paths')
  })

  test('GET /docs returns Swagger UI HTML', async ({ request }) => {
    const response = await request.get(`${ApiBase}/docs`)
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toContain('swagger')
  })
})

// ---------------------------------------------------------------------------
// CMS Basic Render (apps/cms — port 4000)
// ---------------------------------------------------------------------------

test.describe('CMS basic render', () => {
  const CmsBase = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

  test('CMS root path responds', async ({ page }) => {
    // Soft-navigate — allow redirect to /admin or /login
    const response = await page.goto(CmsBase, { waitUntil: 'domcontentloaded' })
    // Any 2xx or 3xx (redirect to admin) is acceptable
    expect(response?.status()).toBeLessThan(500)
  })

  test('CMS admin panel loads without JS error', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.goto(`${CmsBase}/admin`, { waitUntil: 'domcontentloaded' })

    // Filter out known non-blocking warnings (HMR, Next dev overlay)
    const criticalErrors = jsErrors.filter(
      (e) =>
        !(
          e.includes('HMR') ||
          e.includes('webpack') ||
          e.includes('Next.js') ||
          e.includes('hydration')
        ),
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Landing Page (apps/landing — port 3002)
// ---------------------------------------------------------------------------

test.describe('Landing page', () => {
  const LandingBase = process.env.LANDING_BASE_URL || 'http://localhost:3002'

  test('Landing root responds', async ({ page }) => {
    const response = await page.goto(LandingBase, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBeLessThan(500)
  })

  test('Pricing page renders tier cards', async ({ page }) => {
    await page.goto(`${LandingBase}/pricing`, { waitUntil: 'domcontentloaded' })
    // Verify at least one pricing tier heading is visible
    await expect(page.getByText(/free|pro|enterprise/i).first()).toBeVisible()
  })

  test('Waitlist POST returns success', async ({ request }) => {
    const response = await request.post(`${LandingBase}/api/waitlist`, {
      data: { email: `smoke-test-${Date.now()}@example.com`, source: 'smoke-test' },
    })
    // 201 (new signup) or 200 (duplicate) — both are success
    expect([200, 201]).toContain(response.status())
    const body = (await response.json()) as Record<string, unknown>
    expect(body.success).toBe(true)
  })
})
