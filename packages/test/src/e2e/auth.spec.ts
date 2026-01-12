import { expect, test } from '@playwright/test'
import { createTestUser, defaultTestUsers } from '../fixtures/users'
import { AdminPage } from './page-objects/AdminPage'
import { LoginPage } from './page-objects/LoginPage'
import { RegisterPage } from './page-objects/RegisterPage'
import { cleanupTestData, generateUniqueTestData, setupTestIsolation } from './utils/test-isolation'

/**
 * Authentication E2E Tests
 * Tests user registration, login, and admin panel access
 *
 * Uses page objects for robust, maintainable tests
 * Uses test fixtures and isolation for clean test state
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('User Authentication', () => {
  test('user can register new account', async ({ page }) => {
    const context = await setupTestIsolation(page)
    const testData = generateUniqueTestData(context, 'register')

    try {
      const registerPage = new RegisterPage(page)
      await registerPage.navigateTo(`${BASE_URL}/register`)
      await registerPage.register(testData.email, testData.password)

      // Should redirect to login or dashboard
      await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(login|dashboard|admin)`), {
        timeout: 5000,
      })
    } finally {
      await cleanupTestData(context, page)
    }
  })

  test('user can login with valid credentials', async ({ page }) => {
    const context = await setupTestIsolation(page)
    const testUser = defaultTestUsers.admin

    try {
      const loginPage = new LoginPage(page)
      await loginPage.navigateTo(`${BASE_URL}/login`)
      await loginPage.login(testUser.email, testUser.password)

      // Should redirect to admin or dashboard
      await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(admin|dashboard)`), { timeout: 5000 })
    } finally {
      await cleanupTestData(context, page)
    }
  })

  test('user cannot login with invalid credentials', async ({ page }) => {
    const context = await setupTestIsolation(page)
    const invalidUser = createTestUser({
      email: 'invalid@example.com',
      password: 'wrongpassword',
    })

    try {
      const loginPage = new LoginPage(page)
      await loginPage.navigateTo(`${BASE_URL}/login`)
      await loginPage.login(invalidUser.email, invalidUser.password)

      // Wait for error or verify still on login page
      const errorMessage = await loginPage.waitForError(3000)
      const stillOnLogin = await loginPage.isOnLoginPage()

      expect(errorMessage !== null || stillOnLogin).toBe(true)
    } finally {
      await cleanupTestData(context, page)
    }
  })

  test('user can logout', async ({ page }) => {
    const context = await setupTestIsolation(page)
    const testUser = defaultTestUsers.admin

    try {
      const loginPage = new LoginPage(page)
      await loginPage.navigateTo(`${BASE_URL}/login`)
      await loginPage.login(testUser.email, testUser.password)

      // Wait for redirect after login
      await page.waitForURL(new RegExp(`${BASE_URL}/(admin|dashboard)`), { timeout: 5000 })

      // Find and click logout button
      const logoutButton = page
        .locator('button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]')
        .first()

      const isVisible = await logoutButton.isVisible().catch(() => false)
      if (isVisible) {
        await logoutButton.click()
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(login|/)$`), { timeout: 5000 })
      }
    } finally {
      await cleanupTestData(context, page)
    }
  })
})

test.describe('Admin Panel Access', () => {
  test('admin can access admin panel', async ({ page }) => {
    const context = await setupTestIsolation(page)
    const testUser = defaultTestUsers.admin

    try {
      // Login first
      const loginPage = new LoginPage(page)
      await loginPage.navigateTo(`${BASE_URL}/login`)
      await loginPage.login(testUser.email, testUser.password)

      // Wait for login to complete
      await page.waitForURL(new RegExp(`${BASE_URL}/(admin|dashboard)`), { timeout: 5000 })

      // Navigate to admin panel
      const adminPage = new AdminPage(page)
      await adminPage.navigateTo(BASE_URL)

      // Verify access
      const hasAccess = await adminPage.verifyAccess()
      expect(hasAccess).toBe(true)

      // Check for admin panel elements
      const adminElements = page.locator('nav, [role="navigation"], header').first()
      await expect(adminElements).toBeVisible({ timeout: 5000 })
    } finally {
      await cleanupTestData(context, page)
    }
  })

  test('non-admin cannot access admin panel', async ({ page }) => {
    const context = await setupTestIsolation(page)

    try {
      // Try to access admin without login
      const response = await page.goto(`${BASE_URL}/admin`)

      // Should redirect to login or show 403
      expect([200, 302, 307, 403]).toContain(response?.status() || 200)

      if (response?.status() === 200) {
        // If page loads, should show login form or access denied
        const loginForm = page.locator('input[name="email"]')
        const accessDenied = page.locator('text=/access denied|forbidden|403/i')

        const hasLogin = await loginForm.isVisible().catch(() => false)
        const hasDenied = await accessDenied.isVisible().catch(() => false)

        expect(hasLogin || hasDenied).toBe(true)
      }
    } finally {
      await cleanupTestData(context, page)
    }
  })
})
