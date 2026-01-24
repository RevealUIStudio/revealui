/**
 * Base page object class
 *
 * Provides common utilities for all page objects
 */

import type { Locator, Page } from '@playwright/test'

export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Wait for selector with retry
   */
  async waitForSelector(selector: string, timeout = 5000): Promise<Locator> {
    const locator = this.page.locator(selector)
    await locator.waitFor({ state: 'visible', timeout })
    return locator
  }

  /**
   * Retry action with backoff
   */
  async retryAction<T>(action: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    let lastError: Error | null = null

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await action()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (i < maxRetries - 1) {
          await this.page.waitForTimeout(delay * (i + 1))
        }
      }
    }

    throw lastError || new Error('Action failed after retries')
  }

  /**
   * Navigate to URL
   */
  async navigateTo(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'networkidle' })
  }

  /**
   * Wait for navigation
   */
  async waitForNavigation(urlPattern?: string | RegExp): Promise<void> {
    if (urlPattern) {
      await this.page.waitForURL(urlPattern, { waitUntil: 'networkidle' })
    } else {
      await this.page.waitForLoadState('networkidle')
    }
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url()
  }
}
