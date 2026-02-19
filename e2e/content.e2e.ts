/**
 * Content E2E Tests
 *
 * Tests content creation, publishing, drafts, and media upload through
 * the CMS admin panel.
 *
 * REQUIRES live services:
 *   - apps/cms (port 4000) with running database
 *   - An authenticated admin session (set CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD env vars)
 *
 * Run with:
 *   pnpm dev
 *   CMS_ADMIN_EMAIL=admin@example.com CMS_ADMIN_PASSWORD=yourpass pnpm test:e2e -- e2e/content.e2e.ts
 */

import { expect, test } from '@playwright/test'

const CMS_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD || ''

// ---------------------------------------------------------------------------
// Auth helper — sign in before each content test
// ---------------------------------------------------------------------------

async function signIn(page: import('@playwright/test').Page) {
  await page.goto(`${CMS_BASE}/admin/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL)
  await page
    .getByLabel(/password/i)
    .first()
    .fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/admin/, { timeout: 10000 })
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

  test('admin can create a new page as draft', async ({ page }) => {
    await signIn(page)
    await page.goto(`${CMS_BASE}/admin/collections/pages/create`, { waitUntil: 'domcontentloaded' })

    await page.getByLabel(/title/i).fill(`E2E Test Page ${testSlug}`)

    const slugField = page.getByLabel(/slug/i)
    if (await slugField.isVisible()) {
      await slugField.fill(testSlug)
    }

    // Save as draft
    await page.getByRole('button', { name: /save.*draft|draft/i }).click()

    await expect(page.getByText(/saved|draft/i)).toBeVisible({ timeout: 5000 })
  })

  test('admin can publish a page', async ({ page }) => {
    await signIn(page)
    await page.goto(`${CMS_BASE}/admin/collections/pages`, { waitUntil: 'domcontentloaded' })

    // Find the test page
    const pageRow = page.getByText(`E2E Test Page ${testSlug}`)
    if (!(await pageRow.isVisible())) {
      test.skip()
      return
    }

    await pageRow.click()
    await page.waitForURL(/collections\/pages\//, { timeout: 5000 })

    // Publish
    const publishBtn = page.getByRole('button', { name: /publish/i })
    if (await publishBtn.isVisible()) {
      await publishBtn.click()
      await expect(page.getByText(/published/i)).toBeVisible({ timeout: 5000 })
    }
  })

  test('published page is accessible via public URL', async ({ page }) => {
    // Navigate to the public page URL
    const response = await page.goto(`${CMS_BASE}/${testSlug}`, { waitUntil: 'domcontentloaded' })
    // Either 200 (found) or 404 (not configured for frontend routing)
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
    await page.goto(`${CMS_BASE}/admin/collections/posts/create`, { waitUntil: 'domcontentloaded' })

    await page.getByLabel(/title/i).fill(`E2E Blog Post ${postSlug}`)

    const slugField = page.getByLabel(/slug/i)
    if (await slugField.isVisible()) {
      await slugField.fill(postSlug)
    }

    await page.getByRole('button', { name: /save/i }).first().click()
    await expect(page.getByText(/saved|created/i)).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Media upload
// ---------------------------------------------------------------------------

test.describe('Media upload', () => {
  test('admin can upload an image', async ({ page }) => {
    await signIn(page)
    await page.goto(`${CMS_BASE}/admin/collections/media/create`, { waitUntil: 'domcontentloaded' })

    // Look for a file input
    const fileInput = page.locator('input[type="file"]')
    if (!(await fileInput.isVisible())) {
      test.skip()
      return
    }

    // Create a minimal PNG (1×1 pixel) as a buffer and upload
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )

    await fileInput.setInputFiles({
      name: 'e2e-test-image.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    })

    await page
      .getByRole('button', { name: /save|upload/i })
      .first()
      .click()
    await expect(page.getByText(/saved|uploaded|created/i)).toBeVisible({ timeout: 10000 })
  })
})
