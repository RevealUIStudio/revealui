/**
 * E2E Test Helper Utilities
 *
 * Common helper functions for Playwright E2E tests
 */

import { expect, type Page } from '@playwright/test'
import { type A11yCheckOptions, checkAccessibility } from './a11y-helper'

/**
 * Wait for network to be idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout })
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { state: 'visible', timeout })
}

/**
 * Fill form field and wait
 */
export async function fillField(page: Page, selector: string, value: string) {
  await page.fill(selector, value)
  await page.waitForTimeout(100) // Small delay for form validation
}

/**
 * Click and wait for navigation
 */
export async function clickAndNavigate(page: Page, selector: string) {
  await Promise.all([page.waitForNavigation(), page.click(selector)])
}

/**
 * Check for console errors
 */
export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text())
    }
  })

  // Return a function to check errors at the end of test
  return () => {
    expect(errors).toHaveLength(0)
  }
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  method: string = 'GET',
) {
  return page.waitForResponse(
    (response) =>
      (typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url())) && response.request().method() === method,
  )
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({ path: `test-results/screenshots/${name}-${timestamp}.png` })
}

/**
 * Check page performance metrics
 */
export async function checkPerformance(page: Page, thresholds: PerformanceThresholds) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
      firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
      domInteractive: navigation.domInteractive - navigation.fetchStart,
    }
  })

  if (thresholds.domContentLoaded) {
    expect(metrics.domContentLoaded).toBeLessThan(thresholds.domContentLoaded)
  }
  if (thresholds.loadComplete) {
    expect(metrics.loadComplete).toBeLessThan(thresholds.loadComplete)
  }
  if (thresholds.firstPaint) {
    expect(metrics.firstPaint).toBeLessThan(thresholds.firstPaint)
  }

  return metrics
}

export interface PerformanceThresholds {
  domContentLoaded?: number
  loadComplete?: number
  firstPaint?: number
  domInteractive?: number
}

/**
 * Login helper
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await fillField(page, 'input[name="email"]', email)
  await fillField(page, 'input[name="password"]', password)
  await page.click('button[type="submit"]')
  await waitForNetworkIdle(page)
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]')
  await page.click('[data-testid="logout"]')
  await waitForNetworkIdle(page)
}

/**
 * Check accessibility violations using aXe-core.
 *
 * Runs WCAG 2.1 AA compliance checks and fails the test if violations are found.
 * Pass options to disable specific rules or exclude selectors for known issues.
 */
export async function checkA11y(page: Page, options?: A11yCheckOptions): Promise<void> {
  await checkAccessibility(page, options)
}

/**
 * Simulate slow network
 */
export async function simulateSlowNetwork(page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (500 * 1024) / 8, // 500kb/s
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  })
}

/**
 * Restore normal network
 */
export async function restoreNetwork(page: Page) {
  const client = await page.context().newCDPSession(page)
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  })
}

/**
 * Wait for element count
 */
export async function waitForElementCount(
  page: Page,
  selector: string,
  count: number,
  timeout = 5000,
) {
  await page.waitForFunction(
    ({ sel, cnt }) => document.querySelectorAll(sel).length === cnt,
    { sel: selector, cnt: count },
    { timeout },
  )
}

/**
 * Get element text content
 */
export async function getTextContent(page: Page, selector: string): Promise<string> {
  return (await page.textContent(selector)) || ''
}

/**
 * Check if element exists
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return (await page.locator(selector).count()) > 0
}

/**
 * Scroll to element
 */
export async function scrollToElement(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded()
}

/**
 * Hover over element
 */
export async function hoverElement(page: Page, selector: string) {
  await page.hover(selector)
  await page.waitForTimeout(200) // Wait for hover effects
}

/**
 * Clear local storage
 */
export async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * Set viewport size
 */
export async function setViewport(
  page: Page,
  size: 'mobile' | 'tablet' | 'desktop' | { width: number; height: number },
) {
  const viewports = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 },
  }

  const viewport = typeof size === 'string' ? viewports[size] : size
  await page.setViewportSize(viewport)
}
