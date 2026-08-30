/**
 * Admin page object
 *
 * Encapsulates admin panel interactions
 */

import { BasePage } from './BasePage.js';

export class AdminPage extends BasePage {
  /**
   * Navigate to the admin origin. Does not shadow BasePage.navigateTo(url)
   * (GAP-478). Admin lives at `/` after the /admin → / flatten.
   */
  async navigateTo(
    baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4000',
  ): Promise<void> {
    const origin = baseUrl.replace(/\/$/, '');
    await super.navigateTo(`${origin}/`);
    await this.waitForNavigation();
  }

  /**
   * Verify admin access
   */
  verifyAccess(): boolean {
    const url = this.getCurrentUrl();
    // Should not be redirected to login
    return !(url.includes('/login') || url.includes('/signin'));
  }

  /**
   * Navigate to admin section
   */
  async navigateToSection(section: string): Promise<void> {
    const sectionLink = this.page
      .locator(`a[href*="${section}"], button:has-text("${section}")`)
      .first();
    await sectionLink.click();
    await this.waitForNavigation();
  }

  /**
   * Check if on admin page
   */
  isOnAdminPage(): boolean {
    const url = this.getCurrentUrl();
    return url.includes('/');
  }
}
