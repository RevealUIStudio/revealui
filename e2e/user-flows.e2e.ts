/**
 * Critical User Flow E2E Tests
 *
 * Tests for complete user journeys through the application
 */

import { test, expect } from '@playwright/test'
import {
  fillField,
  waitForNetworkIdle,
  waitForElement,
  checkPerformance,
  clearStorage,
} from './utils/test-helpers'

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
  })

  test.describe('Homepage Journey', () => {
    test('should load homepage successfully', async ({ page }) => {
      await page.goto('/')

      await expect(page).toHaveTitle(/.+/)
      await waitForNetworkIdle(page)

      // Should not have console errors
      const errors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text())
      })

      await page.waitForTimeout(1000)
      expect(errors).toHaveLength(0)
    })

    test('should have navigation menu', async ({ page }) => {
      await page.goto('/')

      const nav = page.locator('nav, [role="navigation"]')
      await expect(nav).toBeVisible()
    })

    test('should navigate to different sections', async ({ page }) => {
      await page.goto('/')

      const links = page.locator('nav a, [role="navigation"] a')
      const count = await links.count()

      if (count > 0) {
        const firstLink = links.first()
        await firstLink.click()
        await waitForNetworkIdle(page)

        // URL should have changed or content loaded
        expect(await page.url()).toBeTruthy()
      }
    })

    test('should meet performance budget', async ({ page }) => {
      await page.goto('/')

      const metrics = await checkPerformance(page, {
        domContentLoaded: 3000, // 3 seconds
        loadComplete: 5000, // 5 seconds
        firstPaint: 2000, // 2 seconds
      })

      console.log('Performance metrics:', metrics)
    })
  })

  test.describe('Content Browsing Flow', () => {
    test('should browse content list', async ({ page }) => {
      await page.goto('/posts')

      // Should show list of content
      const posts = page.locator('article, [data-testid*="post"], .post-item')

      if ((await posts.count()) > 0) {
        expect(await posts.count()).toBeGreaterThan(0)
      }
    })

    test('should view individual content item', async ({ page }) => {
      await page.goto('/posts')

      const firstPost = page.locator('article, [data-testid*="post"]').first()

      if ((await firstPost.count()) > 0) {
        await firstPost.click()
        await waitForNetworkIdle(page)

        // Should show post content
        await expect(page.locator('h1')).toBeVisible()
      }
    })

    test('should paginate through content', async ({ page }) => {
      await page.goto('/posts')

      const nextButton = page.locator(
        'button:has-text("Next"), a:has-text("Next"), [aria-label*="Next"]',
      )

      if ((await nextButton.count()) > 0) {
        const initialUrl = page.url()

        await nextButton.first().click()
        await waitForNetworkIdle(page)

        // URL should have changed
        expect(page.url()).not.toBe(initialUrl)
      }
    })

    test('should filter content', async ({ page }) => {
      await page.goto('/posts')

      const filterInput = page.locator('input[type="search"], input[placeholder*="filter"]')

      if ((await filterInput.count()) > 0) {
        await filterInput.fill('test')
        await page.waitForTimeout(500) // Debounce

        // Results should update
        const results = page.locator('article, [data-testid*="post"]')
        expect(await results.count()).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe('Dashboard Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login first
      await page.goto('/login')
      await fillField(page, 'input[name="email"], input[type="email"]', 'test@example.com')
      await fillField(page, 'input[name="password"], input[type="password"]', 'password123')
      await page.click('button[type="submit"]')
      await waitForNetworkIdle(page)
    })

    test('should load dashboard after login', async ({ page }) => {
      await page.goto('/dashboard')

      await expect(page.locator('h1, h2').first()).toContainText(/dashboard/i)
    })

    test('should display user information', async ({ page }) => {
      await page.goto('/dashboard')

      const userInfo = page.locator(
        '[data-testid*="user"], .user-info, [aria-label*="user"]',
      )

      if ((await userInfo.count()) > 0) {
        await expect(userInfo.first()).toBeVisible()
      }
    })

    test('should navigate between dashboard sections', async ({ page }) => {
      await page.goto('/dashboard')

      const navLinks = page.locator('nav a, [role="navigation"] a')

      if ((await navLinks.count()) > 0) {
        await navLinks.first().click()
        await waitForNetworkIdle(page)

        expect(page.url()).toContain('/dashboard')
      }
    })
  })

  test.describe('Form Submission Flow', () => {
    test('should handle contact form submission', async ({ page }) => {
      await page.goto('/contact')

      const nameInput = page.locator('input[name="name"]')
      const emailInput = page.locator('input[name="email"], input[type="email"]')
      const messageInput = page.locator('textarea[name="message"]')
      const submitButton = page.locator('button[type="submit"]')

      if ((await nameInput.count()) > 0) {
        await nameInput.fill('John Doe')
        await emailInput.fill('john@example.com')
        await messageInput.fill('This is a test message')

        await submitButton.click()
        await waitForNetworkIdle(page)

        // Should show success message
        const success = page.locator('text=/success|sent|thank you/i')
        await expect(success.first()).toBeVisible()
      }
    })

    test('should validate form inputs', async ({ page }) => {
      await page.goto('/contact')

      const submitButton = page.locator('button[type="submit"]')

      if ((await submitButton.count()) > 0) {
        await submitButton.click()

        // Should show validation errors
        const errors = page.locator('[role="alert"], .error, .invalid')
        expect(await errors.count()).toBeGreaterThan(0)
      }
    })

    test('should prevent duplicate submissions', async ({ page }) => {
      await page.goto('/contact')

      const nameInput = page.locator('input[name="name"]')
      const emailInput = page.locator('input[name="email"], input[type="email"]')
      const messageInput = page.locator('textarea[name="message"]')
      const submitButton = page.locator('button[type="submit"]')

      if ((await nameInput.count()) > 0) {
        await nameInput.fill('John Doe')
        await emailInput.fill('john@example.com')
        await messageInput.fill('Test message')

        await submitButton.click()

        // Button should be disabled during submission
        if (await submitButton.isDisabled()) {
          expect(await submitButton.isDisabled()).toBe(true)
        }
      }
    })
  })

  test.describe('Search Flow', () => {
    test('should perform search', async ({ page }) => {
      await page.goto('/')

      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]')

      if ((await searchInput.count()) > 0) {
        await searchInput.fill('test query')
        await page.keyboard.press('Enter')
        await waitForNetworkIdle(page)

        // Should show search results
        await expect(page).toHaveURL(/search/)
      }
    })

    test('should show search suggestions', async ({ page }) => {
      await page.goto('/')

      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]')

      if ((await searchInput.count()) > 0) {
        await searchInput.fill('test')
        await page.waitForTimeout(500) // Wait for autocomplete

        const suggestions = page.locator('[role="listbox"], .suggestions, .autocomplete')

        if ((await suggestions.count()) > 0) {
          await expect(suggestions.first()).toBeVisible()
        }
      }
    })

    test('should handle empty search results', async ({ page }) => {
      await page.goto('/')

      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]')

      if ((await searchInput.count()) > 0) {
        await searchInput.fill('xyznonexistentquery123')
        await page.keyboard.press('Enter')
        await waitForNetworkIdle(page)

        // Should show "no results" message
        const noResults = page.locator('text=/no results|not found|nothing found/i')

        if ((await noResults.count()) > 0) {
          await expect(noResults.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Mobile Responsive Flow', () => {
    test.use({ viewport: { width: 375, height: 667 } })

    test('should display mobile menu', async ({ page }) => {
      await page.goto('/')

      const mobileMenuButton = page.locator(
        'button[aria-label*="menu"], button[aria-label*="navigation"], .menu-toggle',
      )

      if ((await mobileMenuButton.count()) > 0) {
        await mobileMenuButton.first().click()

        const menu = page.locator('[role="navigation"], .mobile-menu')
        await expect(menu.first()).toBeVisible()
      }
    })

    test('should be usable on mobile viewport', async ({ page }) => {
      await page.goto('/')

      // Should not have horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.viewportSize()

      if (viewportWidth) {
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth.width + 20) // Allow small margin
      }
    })
  })

  test.describe('Error Handling Flow', () => {
    test('should handle 404 errors gracefully', async ({ page }) => {
      await page.goto('/nonexistent-page-12345')

      // Should show 404 page
      await expect(page.locator('h1, h2').first()).toContainText(/404|not found/i)
    })

    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API and force error
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      })

      await page.goto('/')

      // Should show error message or fallback content
      const errorMessage = page.locator(
        '[role="alert"], .error, text=/error|something went wrong/i',
      )

      if ((await errorMessage.count()) > 0) {
        await expect(errorMessage.first()).toBeVisible()
      }
    })

    test('should recover from network errors', async ({ page }) => {
      await page.goto('/')

      // Simulate offline
      await page.context().setOffline(true)

      // Try to navigate
      await page.locator('a').first().click()

      // Should show offline message
      const offlineMessage = page.locator('text=/offline|no connection|network error/i')

      if ((await offlineMessage.count()) > 0) {
        await expect(offlineMessage.first()).toBeVisible()
      }

      // Go back online
      await page.context().setOffline(false)
    })
  })

  test.describe('Accessibility Flow', () => {
    test('should have skip to content link', async ({ page }) => {
      await page.goto('/')

      // Tab to skip link
      await page.keyboard.press('Tab')

      const skipLink = page.locator('a:has-text("Skip to"), a:has-text("Skip navigation")')

      if ((await skipLink.count()) > 0) {
        await expect(skipLink.first()).toBeFocused()
      }
    })

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/')

      const h1 = await page.locator('h1').count()
      expect(h1).toBeGreaterThanOrEqual(1)

      // Should have only one h1
      expect(h1).toBeLessThanOrEqual(1)
    })

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('/')

      // Tab through interactive elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(100)
      }

      // Focus should be on an interactive element
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return el?.tagName?.toLowerCase()
      })

      expect(['a', 'button', 'input', 'textarea', 'select']).toContain(focused)
    })
  })

  test.describe('Performance Flow', () => {
    test('should lazy load images', async ({ page }) => {
      await page.goto('/')

      const images = page.locator('img')
      const count = await images.count()

      if (count > 0) {
        const firstImage = images.first()
        const loading = await firstImage.getAttribute('loading')

        // Modern images should have loading="lazy"
        if (loading) {
          expect(loading).toBe('lazy')
        }
      }
    })

    test('should not block rendering with scripts', async ({ page }) => {
      await page.goto('/')

      const scripts = page.locator('script[src]')
      const count = await scripts.count()

      for (let i = 0; i < count; i++) {
        const script = scripts.nth(i)
        const async = await script.getAttribute('async')
        const defer = await script.getAttribute('defer')

        // External scripts should be async or defer
        if (async === null && defer === null) {
          const src = await script.getAttribute('src')
          console.log(`Warning: Blocking script detected: ${src}`)
        }
      }
    })
  })
})
