/**
 * Register page object
 *
 * Encapsulates registration page interactions
 */

import type { Locator, Page } from '@playwright/test'
import { BasePage } from './BasePage.js'

export class RegisterPage extends BasePage {
  private emailInput: Locator
  private passwordInput: Locator
  private confirmPasswordInput: Locator
  private submitButton: Locator
  private successMessage: Locator

  constructor(page: Page) {
    super(page)
    this.emailInput = page.locator('input[name="email"], input[type="email"]').first()
    this.passwordInput = page.locator('input[name="password"], input[type="password"]').first()
    this.confirmPasswordInput = page
      .locator('input[name="confirmPassword"], input[name="passwordConfirmation"]')
      .first()
    this.submitButton = page
      .locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign up")')
      .first()
    this.successMessage = page
      .locator('.success, [role="alert"]:has-text("success"), .alert-success')
      .first()
  }

  /**
   * Fill registration form
   */
  async fillForm(email: string, password: string, confirmPassword?: string): Promise<void> {
    await this.waitForSelector('input[name="email"], input[type="email"]')
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)

    if (this.confirmPasswordInput.count() > 0) {
      await this.confirmPasswordInput.fill(confirmPassword || password)
    }
  }

  /**
   * Submit registration form
   */
  async submit(): Promise<void> {
    await this.submitButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Wait for success message
   */
  async waitForSuccess(timeout = 5000): Promise<string | null> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout })
      return await this.successMessage.textContent()
    } catch {
      return null
    }
  }

  /**
   * Complete registration flow
   */
  async register(email: string, password: string, confirmPassword?: string): Promise<void> {
    await this.fillForm(email, password, confirmPassword)
    await this.submit()
  }
}
