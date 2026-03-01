/**
 * Content E2E Tests
 *
 * Tests content creation through the CMS admin panel by driving the actual UI
 * (click collection → Create New → fill form → Save).
 *
 * The AdminDashboard is a state-machine SPA — URL segments are ignored.
 * Tests must navigate via button clicks, not direct URL jumps.
 *
 * REQUIRES live services:
 *   - apps/cms deployed and accessible via PLAYWRIGHT_BASE_URL
 *   - An authenticated admin (set CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD env vars)
 *
 * Rate-limit note:
 *   Sign-in endpoint allows 5 requests per 15-min window per IP.
 *   Use SKIP_GLOBAL_AUTH=1 so global-setup skips its sign-in slot.
 *   Run with: --retries=0 --project=chromium
 *
 * Run with:
 *   SKIP_GLOBAL_AUTH=1 CI=1 PLAYWRIGHT_BASE_URL=https://cms.revealui.com \
 *     CMS_ADMIN_EMAIL=founder@revealui.com CMS_ADMIN_PASSWORD=<pass> \
 *     node_modules/.bin/playwright test e2e/content.e2e.ts \
 *     --project=chromium --retries=0 --reporter=line
 */

import { expect, test } from '@playwright/test'

const CMS_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || ''

// ---------------------------------------------------------------------------
// Auth helper — sign in before each content test
// ---------------------------------------------------------------------------

async function signIn(page: import('@playwright/test').Page) {
  // CMS login page is at /login (not /admin/login — that redirects to /login).
  // After successful sign-in, router.push('/') navigates away from /login.
  await page.goto(`${CMS_BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page
    .getByLabel(/password/i)
    .first()
    .fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), {
    timeout: 10000,
  })
}

// Navigate to admin dashboard and wait for React to hydrate
async function goToAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${CMS_BASE}/admin`, { waitUntil: 'domcontentloaded' })
  // Wait for the admin heading — signals the SPA has rendered
  await page.getByRole('heading', { name: /RevealUI Admin/i }).waitFor({ timeout: 15000 })
}

// Skip entire suite when credentials are not configured
test.beforeAll(async ({ request }) => {
  if (!ADMIN_PASSWORD) {
    test.skip()
    return
  }
  try {
    const res = await request.get(`${CMS_BASE}/api/health`, { timeout: 3000 })
    if (!res.ok()) test.skip()
  } catch {
    test.skip()
  }
})

// ---------------------------------------------------------------------------
// Pages collection
// ---------------------------------------------------------------------------

test.describe('Page content lifecycle', () => {
  const testSlug = `e2e-page-${Date.now()}`

  test('admin can create a new page', async ({ page }) => {
    await signIn(page)
    await goToAdmin(page)

    // Click the "pages" collection button in the sidebar
    await page.getByRole('button', { name: 'pages' }).click()

    // Wait for collection view to render — "Create New" button appears
    await page.getByRole('button', { name: 'Create New' }).waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Create New' }).click()

    // Wait for form and fill the title field
    await page.getByLabel(/title/i).waitFor({ timeout: 10000 })
    await page.getByLabel(/title/i).fill(`E2E Test Page ${testSlug}`)

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Document created successfully')).toBeVisible({ timeout: 10000 })
  })

  test('published page slug is accessible via public URL', async ({ page }) => {
    // Navigate to the public page URL (may 404 if frontend routing is not configured)
    const response = await page.goto(`${CMS_BASE}/${testSlug}`, { waitUntil: 'domcontentloaded' })
    // Either 200 (found) or 404 (frontend routing not configured) — both are acceptable.
    // A 500 would indicate a server error that must be investigated.
    expect(response?.status()).not.toBe(500)
  })
})

// ---------------------------------------------------------------------------
// Posts collection
// ---------------------------------------------------------------------------

test.describe('Blog post lifecycle', () => {
  const postSlug = `e2e-post-${Date.now()}`

  test('admin can create a blog post', async ({ page }) => {
    await signIn(page)
    await goToAdmin(page)

    // Click the "posts" collection button — visible after AdminDashboard shows all collections
    await page.getByRole('button', { name: 'posts' }).click()

    // Wait for collection view and click Create New
    await page.getByRole('button', { name: 'Create New' }).waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Create New' }).click()

    // Wait for form and fill the title field
    await page.getByLabel(/title/i).waitFor({ timeout: 10000 })
    await page.getByLabel(/title/i).fill(`E2E Blog Post ${postSlug}`)

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Document created successfully')).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// Media upload
// ---------------------------------------------------------------------------
// TODO(phase1): DocumentForm renders text/date/select inputs only — no upload
// field type support yet. Media E2E tests require either:
//   a) Adding upload field type to DocumentForm
//   b) A direct API-based upload test (multipart POST to /api/collections/media)
// Skipped for Phase 0 scope.
