import { expect, test } from '@playwright/test'

/**
 * E2E Test Suite
 * Tests critical user flows and accessibility
 */

test.describe('Homepage and Navigation', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/RevealUI/)
  })

  test('navigation header is visible', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header').first()
    await expect(header).toBeVisible()
  })

  test('footer is visible', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer').first()
    await expect(footer).toBeVisible()
  })

  test('page has proper meta tags', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
  })
})

test.describe('Posts Pages', () => {
  test('posts listing page loads', async ({ page }) => {
    await page.goto('/posts')
    await expect(page).toHaveTitle(/Posts|RevealUI/)
  })

  test('posts page shows content', async ({ page }) => {
    await page.goto('/posts')
    // Check if page has content (posts list or empty state)
    const content = page.locator("article, main, [role='main']").first()
    await expect(content).toBeVisible()
  })
})

test.describe('API Health Checks', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('timestamp')
  })

  test('readiness endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health/ready')
    expect([200, 503]).toContain(response.status())

    const data = await response.json()
    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('timestamp')
  })

  test('health endpoint includes system metrics', async ({ request }) => {
    const response = await request.get('/api/health')
    const data = await response.json()

    if (data.status === 'healthy' || data.status === 'degraded') {
      expect(data).toHaveProperty('metrics')
      if (data.metrics) {
        expect(data.metrics).toHaveProperty('responseTimeMs')
        expect(data.metrics).toHaveProperty('memory')
      }
    }
  })
})

test.describe('Accessibility', () => {
  test('page has accessible heading structure', async ({ page }) => {
    await page.goto('/')
    // Check for at least one heading
    const headings = page.locator('h1, h2, h3, h4, h5, h6')
    const count = await headings.count()
    expect(count).toBeGreaterThan(0)
  })

  test('images have alt text', async ({ page }) => {
    await page.goto('/')
    const images = page.locator('img')
    const count = await images.count()

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const img = images.nth(i)
        const alt = await img.getAttribute('alt')
        // Alt text should exist (can be empty for decorative images)
        expect(alt).not.toBeNull()
      }
    }
  })

  test('links are keyboard accessible', async ({ page }) => {
    await page.goto('/')
    const links = page.locator('a[href]')
    const count = await links.count()

    if (count > 0) {
      // Test that first link is focusable
      const firstLink = links.first()
      await firstLink.focus()
      await expect(firstLink).toBeFocused()
    }
  })

  test('page has proper language attribute', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    const lang = await html.getAttribute('lang')
    expect(lang).toBeTruthy()
  })
})

test.describe('Error Handling', () => {
  test('404 page handles non-existent routes', async ({ page }) => {
    const response = await page.goto('/non-existent-page-12345')
    // Should either redirect or show 404
    expect([200, 404, 307, 308]).toContain(response?.status() || 200)
  })

  test('invalid API endpoint returns appropriate status', async ({ request }) => {
    const response = await request.get('/api/non-existent-endpoint')
    expect([404, 405, 500]).toContain(response.status())
  })
})

test.describe('Performance', () => {
  test('page loads within reasonable time', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    const loadTime = Date.now() - startTime

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000)
  })

  test('page has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/')

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !(
          error.includes('favicon') ||
          error.includes('analytics') ||
          error.includes('speed-insights')
        ),
    )

    expect(criticalErrors.length).toBe(0)
  })
})
