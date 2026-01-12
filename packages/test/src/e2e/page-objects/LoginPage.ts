/**
 * Login page object
 *
 * Encapsulates login page interactions
 */

import type { Locator, Page } from '@playwright/test'
import { BasePage } from './BasePage'

export class LoginPage extends BasePage {
  private emailInput: Locator
  private passwordInput: Locator
  private submitButton: Locator
  private errorMessage: Locator

  constructor(page: Page) {
    super(page)
    this.emailInput = page.locator('input[name="email"], input[type="email"]').first()
    this.passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    this.submitButton = page
      .locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")')
      .first()
    this.errorMessage = page.locator('.error, [role="alert"], .alert-error').first()
  }

  /**
   * Fill email input
   */
  async fillEmail(email: string): Promise<void> {
    await this.waitForSelector('input[name="email"], input[type="email"]')
    await this.emailInput.fill(email)
  }

  /**
   * Fill password input
   */
  async fillPassword(password: string): Promise<void> {
    await this.waitForSelector('input[name="password"], input[type="password"]')
    await this.passwordInput.fill(password)
  }

  /**
   * Submit login form
   */
  async submit(): Promise<void> {
    await this.submitButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for error message
   */
  async waitForError(timeout = 5000): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout })
      return await this.errorMessage.textContent()
    } catch {
      return null
    }
  }

  /**
   * Complete login flow
   */
  async login(email: string, password: string): Promise<void> {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.submit()
  }

  /**
   * Check if on login page
   */
  async isOnLoginPage(): Promise<boolean> {
    const url = this.getCurrentUrl()
    return url.includes('/login') || url.includes('/signin')
  }
}
