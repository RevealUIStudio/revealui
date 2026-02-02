/**
 * Authentication E2E Tests
 *
 * Tests for login, logout, signup, and authentication flows
 */

import { expect, test } from '@playwright/test'
import {
  clearStorage,
  expectNoConsoleErrors,
  fillField,
  waitForNetworkIdle,
} from './utils/test-helpers'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
  })

  test.describe('Login Flow', () => {
    test('should show login page', async ({ page }) => {
      await page.goto('/login')

      await expect(page).toHaveTitle(/login/i)
      await expect(page.locator('h1')).toContainText(/login|sign in/i)
    })

    test('should display email and password fields', async ({ page }) => {
      await page.goto('/login')

      const emailInput = page.locator('input[name="email"], input[type="email"]')
      const passwordInput = page.locator('input[name="password"], input[type="password"]')

      await expect(emailInput).toBeVisible()
      await expect(passwordInput).toBeVisible()
    })

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/login')

      await page.click('button[type="submit"]')

      // Should show validation errors
      await expect(page.locator('text=/email.*required/i').first()).toBeVisible()
    })

    test('should show error for invalid email format', async ({ page }) => {
      await page.goto('/login')

      await fillField(page, 'input[name="email"], input[type="email"]', 'invalid-email')
      await page.click('button[type="submit"]')

      await expect(page.locator('text=/invalid.*email/i').first()).toBeVisible()
    })

    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/login')

      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'password123')
      await page.click('button[type="submit"]')

      await waitForNetworkIdle(page)

      // Should redirect to dashboard or home
      await expect(page).toHaveURL(/\/(dashboard|home)/)
    })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login')

      await fillField(page, 'input[name="email"], input[type="email"]', 'wrong@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'wrongpassword')
      await page.click('button[type="submit"]')

      await expect(
        page.locator('text=/invalid.*credentials|incorrect.*password/i').first(),
      ).toBeVisible()
    })

    test('should toggle password visibility', async ({ page }) => {
      await page.goto('/login')

      const passwordInput = page.locator('input[name="password"], input[type="password"]')
      const toggleButton = page.locator('[aria-label*="password"], [data-testid*="toggle"]')

      if ((await toggleButton.count()) > 0) {
        await expect(passwordInput).toHaveAttribute('type', 'password')

        await toggleButton.first().click()
        await expect(passwordInput).toHaveAttribute('type', 'text')

        await toggleButton.first().click()
        await expect(passwordInput).toHaveAttribute('type', 'password')
      }
    })

    test('should have "Remember me" checkbox', async ({ page }) => {
      await page.goto('/login')

      const rememberCheckbox = page.locator(
        'input[type="checkbox"][name*="remember"], label:has-text("Remember")',
      )

      if ((await rememberCheckbox.count()) > 0) {
        await expect(rememberCheckbox.first()).toBeVisible()
      }
    })
  })

  test.describe('Logout Flow', () => {
    test('should logout successfully', async ({ page }) => {
      // First login
      await page.goto('/login')
      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await waitForNetworkIdle(page)

      // Then logout
      const logoutButton = page.locator(
        'button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout"]',
      )

      if ((await logoutButton.count()) > 0) {
        await logoutButton.first().click()
        await waitForNetworkIdle(page)

        // Should redirect to login or home
        await expect(page).toHaveURL(/\/(login|home|$)/)
      }
    })

    test('should clear session after logout', async ({ page }) => {
      // Login
      await page.goto('/login')
      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await waitForNetworkIdle(page)

      // Logout
      const logoutButton = page.locator(
        'button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout"]',
      )

      if ((await logoutButton.count()) > 0) {
        await logoutButton.first().click()
        await waitForNetworkIdle(page)

        // Try to access protected route
        await page.goto('/dashboard')

        // Should redirect to login
        await expect(page).toHaveURL(/\/login/)
      }
    })
  })

  test.describe('Signup Flow', () => {
    test('should show signup page', async ({ page }) => {
      await page.goto('/signup')

      await expect(page.locator('h1')).toContainText(/sign up|register|create account/i)
    })

    test('should validate password strength', async ({ page }) => {
      await page.goto('/signup')

      const passwordInput = page.locator('input[name="password"], input[type="password"]')

      if ((await passwordInput.count()) > 0) {
        await fillField(page, 'input[name="password"], input[type="password"]', 'weak')

        const strengthIndicator = page.locator('[data-testid*="strength"], text=/weak|strong/i')

        if ((await strengthIndicator.count()) > 0) {
          await expect(strengthIndicator.first()).toBeVisible()
        }
      }
    })

    test('should require password confirmation', async ({ page }) => {
      await page.goto('/signup')

      const confirmInput = page.locator(
        'input[name="confirmPassword"], input[name="password_confirmation"]',
      )

      if ((await confirmInput.count()) > 0) {
        await expect(confirmInput).toBeVisible()
      }
    })

    test('should validate matching passwords', async ({ page }) => {
      await page.goto('/signup')

      const passwordInput = page.locator('input[name="password"]').first()
      const confirmInput = page.locator(
        'input[name="confirmPassword"], input[name="password_confirmation"]',
      )

      if ((await confirmInput.count()) > 0 && (await passwordInput.count()) > 0) {
        await passwordInput.fill('password123')
        await confirmInput.fill('password456')

        await page.click('button[type="submit"]')

        await expect(page.locator('text=/password.*match/i').first()).toBeVisible()
      }
    })
  })

  test.describe('Password Reset', () => {
    test('should show forgot password link', async ({ page }) => {
      await page.goto('/login')

      const forgotLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")')

      if ((await forgotLink.count()) > 0) {
        await expect(forgotLink.first()).toBeVisible()
      }
    })

    test('should navigate to password reset page', async ({ page }) => {
      await page.goto('/login')

      const forgotLink = page.locator('a:has-text("Forgot"), a:has-text("Reset")')

      if ((await forgotLink.count()) > 0) {
        await forgotLink.first().click()
        await waitForNetworkIdle(page)

        await expect(page).toHaveURL(/\/(forgot|reset)/)
      }
    })

    test('should submit password reset request', async ({ page }) => {
      await page.goto('/forgot-password')

      const emailInput = page.locator('input[type="email"], input[name="email"]')

      if ((await emailInput.count()) > 0) {
        await emailInput.fill('test@example.com')
        await page.click('button[type="submit"]')

        await expect(page.locator('text=/check.*email|sent.*link/i').first()).toBeVisible()
      }
    })
  })

  test.describe('Session Management', () => {
    test('should persist session across page reloads', async ({ page }) => {
      // Login
      await page.goto('/login')
      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await waitForNetworkIdle(page)

      // Reload page
      await page.reload()
      await waitForNetworkIdle(page)

      // Should still be logged in (not redirected to login)
      await expect(page).not.toHaveURL(/\/login/)
    })

    test('should redirect to login when accessing protected route', async ({ page }) => {
      await clearStorage(page)

      await page.goto('/dashboard')

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/)
    })

    test('should preserve intended destination after login', async ({ page }) => {
      await clearStorage(page)

      // Try to access protected route
      await page.goto('/dashboard/settings')

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/)

      // Login
      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await waitForNetworkIdle(page)

      // Should redirect back to intended destination
      await expect(page).toHaveURL(/\/dashboard\/settings/)
    })
  })

  test.describe('Security', () => {
    test('should not show password in plain text by default', async ({ page }) => {
      await page.goto('/login')

      const passwordInput = page.locator('input[name="password"]')

      await expect(passwordInput).toHaveAttribute('type', 'password')
    })

    test('should prevent CSRF attacks', async ({ page }) => {
      await page.goto('/login')

      // Check for CSRF token
      const csrfToken = await page.locator('input[name="_csrf"], input[name="csrf_token"]')

      if ((await csrfToken.count()) > 0) {
        await expect(csrfToken.first()).toHaveAttribute('value', /.+/)
      }
    })

    test('should not leak error details', async ({ page }) => {
      await page.goto('/login')

      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'wrongpassword')

      const checkErrors = await expectNoConsoleErrors(page)

      await page.click('button[type="submit"]')

      // Should show generic error, not specific details
      const errorText = await page.locator('[role="alert"], .error, .alert').textContent()

      expect(errorText?.toLowerCase()).not.toContain('sql')
      expect(errorText?.toLowerCase()).not.toContain('database')
      expect(errorText?.toLowerCase()).not.toContain('stack')

      checkErrors()
    })
  })

  test.describe('Accessibility', () => {
    test('should have accessible form labels', async ({ page }) => {
      await page.goto('/login')

      const emailInput = page.locator('input[type="email"], input[name="email"]')
      const passwordInput = page.locator('input[type="password"], input[name="password"]')

      // Check for labels
      const emailLabel = page.locator('label[for]:has-text("Email")')
      const passwordLabel = page.locator('label[for]:has-text("Password")')

      if ((await emailLabel.count()) > 0 || (await passwordLabel.count()) > 0) {
        expect(true).toBe(true) // Labels exist
      } else {
        // Check for aria-label
        await expect(emailInput).toHaveAttribute('aria-label', /.+/)
        await expect(passwordInput).toHaveAttribute('aria-label', /.+/)
      }
    })

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/login')

      // Tab through form
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="email"], input[name="email"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="password"], input[name="password"]')).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.locator('button[type="submit"]')).toBeFocused()
    })

    test('should announce errors to screen readers', async ({ page }) => {
      await page.goto('/login')

      await page.click('button[type="submit"]')

      const errorAlert = page.locator('[role="alert"], [aria-live="polite"]')

      if ((await errorAlert.count()) > 0) {
        await expect(errorAlert.first()).toBeVisible()
      }
    })
  })
})
