/**
 * Admin page object
 *
 * Encapsulates admin panel interactions
 */

import { BasePage } from './BasePage.js';

export class AdminPage extends BasePage {
  /**
   * Navigate to admin panel
   */
  async navigateTo(baseUrl = 'http://localhost:3000'): Promise<void> {
    await this.navigateTo(`${baseUrl}/admin`);
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
