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
 *   - CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD so global-setup can create auth state
 *
 * Auth strategy:
 *   global-setup signs in ONCE and saves the session cookie to e2e/.auth/user.json.
 *   Each test reuses that state via test.use({ storageState }) — no per-test sign-in.
 *   This keeps total sign-in requests well within the 5/15min rate limit.
 *
 * Collection choice:
 *   Pages/Posts have required `blocks`/`richText` fields that DocumentForm
 *   cannot render (it only handles text/number/checkbox/select/date).
 *   Save would always fail for those collections via the admin UI.
 *   The `categories` collection has only `title` (text, required) — ideal for
 *   verifying the full admin CRUD flow.
 *
 * Run with:
 *   CI=1 PLAYWRIGHT_BASE_URL=https://cms.revealui.com \
 *     CMS_ADMIN_EMAIL=founder@revealui.com CMS_ADMIN_PASSWORD=<pass> \
 *     node_modules/.bin/playwright test e2e/content.e2e.ts \
 *     --project=chromium --retries=0 --reporter=line
 */

import { existsSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const CMS_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

// Auth state file written by global-setup (one sign-in per test run)
const AUTH_STATE_FILE = 'e2e/.auth/user.json'

// ---------------------------------------------------------------------------
// Navigation helper
// ---------------------------------------------------------------------------

async function goToAdmin(page: Page) {
  await page.goto(`${CMS_BASE}/admin`, { waitUntil: 'domcontentloaded' })
  // Wait for SSR heading — signals HTML is ready
  await page.getByRole('heading', { name: /RevealUI Admin/i }).waitFor({ timeout: 15000 })
  // Wait for JS bundles to load so React can hydrate and attach onClick handlers
  await page.waitForLoadState('load')
}

// ---------------------------------------------------------------------------
// Categories collection — simple CRUD (title-only, no complex field types)
// ---------------------------------------------------------------------------
// Uses `categories` instead of `pages`/`posts` because:
//   - Pages requires `layout` (blocks, required) — DocumentForm cannot fill blocks
//   - Posts requires `content` (richText, required) — DocumentForm cannot fill richText
//   - Categories only requires `title` (text) — works with current DocumentForm

test.describe('Content CRUD lifecycle', () => {
  // Reuse the session cookie saved by global-setup — no per-test sign-in needed.
  // This avoids the 5/15min sign-in rate limit when retries are enabled.
  test.use({ storageState: AUTH_STATE_FILE })

  const testTitle = `E2E Category ${Date.now()}`

  test.beforeAll(async ({ request }) => {
    // Skip entire suite if auth state doesn't exist (global-setup skipped or failed)
    if (!existsSync(AUTH_STATE_FILE)) {
      test.skip()
      return
    }
    // Skip if CMS is unreachable
    try {
      const res = await request.get(`${CMS_BASE}/api/health`, { timeout: 5000 })
      if (!res.ok()) test.skip()
    } catch {
      test.skip()
    }
  })

  test('admin can create a document via admin UI', async ({ page }) => {
    await goToAdmin(page)

    // Click categories — retry if React hasn't hydrated yet (onClick not attached)
    await expect(async () => {
      await page.getByRole('button', { name: 'categories' }).click()
      await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({
        timeout: 3000,
      })
    }).toPass({ timeout: 20000 })

    await page.getByRole('button', { name: 'Create New' }).click()

    // Wait for form and fill the title field
    await page.getByLabel(/title/i).waitFor({ timeout: 10000 })
    await page.getByLabel(/title/i).fill(testTitle)

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Document created successfully')).toBeVisible({ timeout: 10000 })
  })

  test('admin can create a second document (verifies list + Create New flow)', async ({ page }) => {
    await goToAdmin(page)

    await expect(async () => {
      await page.getByRole('button', { name: 'categories' }).click()
      await expect(page.getByRole('button', { name: 'Create New' })).toBeVisible({
        timeout: 3000,
      })
    }).toPass({ timeout: 20000 })

    await page.getByRole('button', { name: 'Create New' }).click()

    await page.getByLabel(/title/i).waitFor({ timeout: 10000 })
    await page.getByLabel(/title/i).fill(`E2E Category Second ${Date.now()}`)

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
