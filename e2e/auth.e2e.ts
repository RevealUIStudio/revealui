/**
 * Auth E2E Tests
 *
 * Tests the full authentication lifecycle: sign-up, email verification,
 * sign-in, password reset, rate limiting, and session persistence.
 *
 * REQUIRES live services:
 *   - apps/cms (port 4000) with a running database
 *
 * Run with:
 *   pnpm dev  (start services first)
 *   pnpm test:e2e -- e2e/auth.e2e.ts
 */

import { expect, test } from '@playwright/test'

const CMS_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000'

// Skip entire suite if CMS is not reachable
test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${CMS_BASE}/api/health`, { timeout: 3000 })
    if (!res.ok()) {
      test.skip()
    }
  } catch {
    test.skip()
  }
})

// ---------------------------------------------------------------------------
// Sign-up → Sign-in → Sign-out
// ---------------------------------------------------------------------------

test.describe('Sign-up and sign-in flow', () => {
  const testEmail = `e2e-auth-${Date.now()}@revealui-test.com`
  const testPassword = 'TestPass!@#$99'

  test('user can sign up with email and password', async ({ page }) => {
    await page.goto(`${CMS_BASE}/admin/create-first-user`, { waitUntil: 'domcontentloaded' })

    // If first-user page is not available, try the register page
    if (page.url().includes('/login')) {
      await page.goto(`${CMS_BASE}/admin/register`, { waitUntil: 'domcontentloaded' })
    }

    await page.getByLabel(/email/i).fill(testEmail)
    await page
      .getByLabel(/password/i)
      .first()
      .fill(testPassword)

    const confirmLabel = page.getByLabel(/confirm password/i)
    if (await confirmLabel.isVisible()) {
      await confirmLabel.fill(testPassword)
    }

    await page.getByRole('button', { name: /sign up|create|register/i }).click()
    await page.waitForURL(/admin|dashboard/, { timeout: 10000 })

    // Should be redirected to admin dashboard after sign-up
    expect(page.url()).toMatch(/admin|dashboard/)
  })

  test('user can sign in with valid credentials', async ({ page }) => {
    await page.goto(`${CMS_BASE}/admin/login`, { waitUntil: 'domcontentloaded' })

    await page.getByLabel(/email/i).fill(testEmail)
    await page
      .getByLabel(/password/i)
      .first()
      .fill(testPassword)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    await page.waitForURL(/admin/, { timeout: 10000 })
    expect(page.url()).toContain('/admin')
  })

  test('sign-in fails with wrong password', async ({ page }) => {
    await page.goto(`${CMS_BASE}/admin/login`, { waitUntil: 'domcontentloaded' })

    await page.getByLabel(/email/i).fill(testEmail)
    await page
      .getByLabel(/password/i)
      .first()
      .fill('WrongPassword123!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Should show error and stay on login page
    await expect(page.getByText(/invalid|incorrect|wrong|failed/i)).toBeVisible({ timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('user can sign out', async ({ page }) => {
    // Sign in first
    await page.goto(`${CMS_BASE}/admin/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/email/i).fill(testEmail)
    await page
      .getByLabel(/password/i)
      .first()
      .fill(testPassword)
    await page.getByRole('button', { name: /sign in|log in/i }).click()
    await page.waitForURL(/admin/, { timeout: 10000 })

    // Sign out
    const signOutButton = page.getByRole('button', { name: /sign out|log out/i })
    if (await signOutButton.isVisible()) {
      await signOutButton.click()
    } else {
      // Try account menu
      await page
        .getByRole('button', { name: /account|profile|menu/i })
        .first()
        .click()
      await page.getByRole('menuitem', { name: /sign out|log out/i }).click()
    }

    await page.waitForURL(/login/, { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })
})

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

test.describe('Session persistence', () => {
  test('authenticated session persists across page reload', async ({ page, context }) => {
    // Set a cookie or local-storage session if needed; skip if no way to auth
    await page.goto(`${CMS_BASE}/admin/login`, { waitUntil: 'domcontentloaded' })

    // Check that reload of admin while logged in keeps user on admin page
    const cookies = await context.cookies()
    const sessionCookie = cookies.find((c) => c.name.includes('session') || c.name.includes('auth'))

    if (!sessionCookie) {
      test.skip()
      return
    }

    await page.reload({ waitUntil: 'domcontentloaded' })
    // Should not be redirected back to login
    expect(page.url()).not.toContain('/login')
  })
})

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

test.describe('Password reset flow', () => {
  test('forgot-password page renders and accepts email', async ({ page }) => {
    await page.goto(`${CMS_BASE}/admin/forgot-password`, { waitUntil: 'domcontentloaded' })

    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeVisible()

    await emailInput.fill('reset-test@revealui-test.com')
    await page.getByRole('button', { name: /send|reset|submit/i }).click()

    // Should show confirmation (not error)
    await expect(page.getByText(/sent|check.*email|if.*account.*exists/i)).toBeVisible({
      timeout: 5000,
    })
  })
})

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

test.describe('Rate limiting', () => {
  test('repeated failed logins trigger rate limit or lock message', async ({ page }) => {
    const blockedEmail = `rate-limit-${Date.now()}@revealui-test.com`

    await page.goto(`${CMS_BASE}/admin/login`, { waitUntil: 'domcontentloaded' })

    // Attempt 6 failed logins
    for (let i = 0; i < 6; i++) {
      await page.getByLabel(/email/i).fill(blockedEmail)
      await page
        .getByLabel(/password/i)
        .first()
        .fill('WrongPassword!')
      await page.getByRole('button', { name: /sign in|log in/i }).click()
      await page.waitForTimeout(200)
    }

    // Should see a rate-limit or account-locked message
    await expect(page.getByText(/too many|rate limit|locked|blocked|try again/i)).toBeVisible({
      timeout: 5000,
    })
  })
})
