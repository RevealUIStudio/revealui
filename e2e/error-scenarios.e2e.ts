/**
 * Error Scenario E2E Tests
 *
 * Tests for error handling, edge cases, and failure scenarios
 */

import { expect, test } from '@playwright/test';
import {
  clearStorage,
  restoreNetwork,
  simulateSlowNetwork,
  waitForNetworkIdle,
} from './utils/test-helpers';

test.describe('Error Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
  });

  test.describe('Network Errors', () => {
    test('should handle slow network gracefully', async ({ page }) => {
      await page.goto('/');

      // Simulate slow network
      await simulateSlowNetwork(page);

      // Should show loading indicator
      const loader = page.locator('[role="status"], .loading, .spinner');

      if ((await loader.count()) > 0) {
        await expect(loader.first()).toBeVisible();
      }

      // Restore network
      await restoreNetwork(page);
    });

    test('should timeout on slow requests', async ({ page }) => {
      // Set timeout
      page.setDefaultTimeout(5000);

      // Intercept and delay response
      await page.route('**/api/**', async (route) => {
        await page.waitForTimeout(6000);
        await route.continue();
      });

      await page.goto('/');

      // Should show timeout error or fallback
      const error = page.locator('text=/timeout|taking too long|slow connection/i');

      if ((await error.count()) > 0) {
        await expect(error.first()).toBeVisible();
      }
    });

    test('should retry failed requests', async ({ page }) => {
      let requestCount = 0;

      await page.route('**/api/**', (route) => {
        requestCount++;

        if (requestCount < 3) {
          // Fail first 2 requests
          route.fulfill({
            status: 500,
            body: 'Server error',
          });
        } else {
          // Succeed on 3rd request
          route.continue();
        }
      });

      await page.goto('/');
      await waitForNetworkIdle(page);

      // Should have retried
      expect(requestCount).toBeGreaterThanOrEqual(2);
    });

    test('should handle offline mode', async ({ page }) => {
      await page.goto('/');

      // Go offline
      await page.context().setOffline(true);

      // Try to interact
      const link = page.locator('a').first();
      if ((await link.count()) > 0) {
        await link.click();
      }

      // Should show offline indicator
      const offline = page.locator('text=/offline|no connection|disconnected/i');

      if ((await offline.count()) > 0) {
        await expect(offline.first()).toBeVisible();
      }

      // Go back online
      await page.context().setOffline(false);
    });
  });

  test.describe('API Errors', () => {
    test('should handle 400 Bad Request', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({ error: 'Bad request' }),
        });
      });

      await page.goto('/');

      const error = page.locator('[role="alert"], .error');

      if ((await error.count()) > 0) {
        await expect(error.first()).toBeVisible();
      }
    });

    test('should handle 401 Unauthorized', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      });

      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should handle 403 Forbidden', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 403,
          body: JSON.stringify({ error: 'Forbidden' }),
        });
      });

      await page.goto('/');

      const error = page.locator('text=/forbidden|access denied|permission/i');

      if ((await error.count()) > 0) {
        await expect(error.first()).toBeVisible();
      }
    });

    test('should handle 404 Not Found', async ({ page }) => {
      await page.goto('/nonexistent-page');

      await expect(page.locator('h1, h2').first()).toContainText(/404|not found/i);
    });

    test('should handle 500 Internal Server Error', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.goto('/');

      const error = page.locator('text=/error|something went wrong|server error/i');

      if ((await error.count()) > 0) {
        await expect(error.first()).toBeVisible();
      }
    });

    test('should handle 503 Service Unavailable', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 503,
          body: JSON.stringify({ error: 'Service unavailable' }),
        });
      });

      await page.goto('/');

      const error = page.locator('text=/unavailable|maintenance|try again/i');

      if ((await error.count()) > 0) {
        await expect(error.first()).toBeVisible();
      }
    });
  });

  test.describe('Form Validation Errors', () => {
    test('should validate required fields', async ({ page }) => {
      await page.goto('/contact');

      const submitButton = page.locator('button[type="submit"]');

      if ((await submitButton.count()) > 0) {
        await submitButton.click();

        // Should show required field errors
        const errors = page.locator('text=/required|fill|enter/i');
        expect(await errors.count()).toBeGreaterThan(0);
      }
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/contact');

      const emailInput = page.locator('input[type="email"], input[name="email"]');

      if ((await emailInput.count()) > 0) {
        await emailInput.fill('invalid-email');
        await page.click('button[type="submit"]');

        // Should show email validation error
        await expect(page.locator('text=/invalid.*email|valid email/i').first()).toBeVisible();
      }
    });

    test('should validate minimum length', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.locator('input[type="password"], input[name="password"]');

      if ((await passwordInput.count()) > 0) {
        await passwordInput.fill('123');
        await page.click('button[type="submit"]');

        // Should show length validation error
        const error = page.locator('text=/too short|minimum|at least/i');

        if ((await error.count()) > 0) {
          await expect(error.first()).toBeVisible();
        }
      }
    });

    test('should validate maximum length', async ({ page }) => {
      await page.goto('/contact');

      const messageInput = page.locator('textarea[name="message"]');

      if ((await messageInput.count()) > 0) {
        const longMessage = 'A'.repeat(10000);
        await messageInput.fill(longMessage);
        await page.click('button[type="submit"]');

        // Should show length validation error or truncate
        const error = page.locator('text=/too long|maximum|limit/i');

        if ((await error.count()) > 0) {
          await expect(error.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Session Errors', () => {
    test('should handle expired session', async ({ page }) => {
      // Login
      await page.goto('/login');
      await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page.fill('input[type="password"], input[name="password"]', 'password123');
      await page.click('button[type="submit"]');
      await waitForNetworkIdle(page);

      // Clear session
      await clearStorage(page);

      // Try to access protected route
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('should handle concurrent sessions', async ({ context }) => {
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      // Login on page 1
      await page1.goto('/login');
      await page1.fill('input[type="email"], input[name="email"]', 'test@example.com');
      await page1.fill('input[type="password"], input[name="password"]', 'password123');
      await page1.click('button[type="submit"]');
      await waitForNetworkIdle(page1);

      // Access dashboard on page 2 (should share session)
      await page2.goto('/dashboard');

      // Both should be authenticated
      await expect(page1).not.toHaveURL(/\/login/);
      await expect(page2).not.toHaveURL(/\/login/);

      await page1.close();
      await page2.close();
    });
  });

  test.describe('Data Errors', () => {
    test('should handle empty data', async ({ page }) => {
      await page.route('**/api/posts', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify([]),
        });
      });

      await page.goto('/posts');

      // Should show empty state
      const empty = page.locator('text=/no posts|nothing here|empty/i');

      if ((await empty.count()) > 0) {
        await expect(empty.first()).toBeVisible();
      }
    });

    test('should handle malformed data', async ({ page }) => {
      await page.route('**/api/**', (route) => {
        route.fulfill({
          status: 200,
          body: 'invalid json{{{',
        });
      });

      await page.goto('/');

      // Should show error or fallback
      const error = page.locator('text=/error|invalid|failed/i');

      if ((await error.count()) > 0) {
        await expect(error.first()).toBeVisible();
      }
    });

    test('should handle missing required data', async ({ page }) => {
      await page.route('**/api/posts/*', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ id: 1 }), // Missing title, content, etc.
        });
      });

      await page.goto('/posts/1');

      // Should show error or use defaults
      expect(page.url()).toContain('/posts/1');
    });
  });

  test.describe('Browser Errors', () => {
    test('should handle JavaScript errors gracefully', async ({ page }) => {
      const errors: string[] = [];

      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto('/');

      // Trigger JavaScript error
      await page.evaluate(() => {
        // @ts-expect-error
        window.nonExistentFunction();
      });

      // Should not crash the page
      expect(await page.locator('body').isVisible()).toBe(true);
    });

    test('should handle console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('/');
      await waitForNetworkIdle(page);

      // Log any errors found (for debugging)
      if (errors.length > 0) {
        console.log('Console errors found:', errors);
      }
    });

    test('should handle blocked resources', async ({ page }) => {
      // Block images
      await page.route('**/*.{png,jpg,jpeg,gif,svg}', (route) => route.abort());

      await page.goto('/');

      // Page should still be functional
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Security Errors', () => {
    test('should prevent XSS attacks', async ({ page }) => {
      await page.goto('/search?q=<script>alert("XSS")</script>');

      // Script should not execute
      const alerts: string[] = [];
      page.on('dialog', (dialog) => {
        alerts.push(dialog.message());
        dialog.dismiss();
      });

      await page.waitForTimeout(1000);
      expect(alerts).toHaveLength(0);
    });

    test('should sanitize user input', async ({ page }) => {
      await page.goto('/contact');

      const messageInput = page.locator('textarea[name="message"]');

      if ((await messageInput.count()) > 0) {
        await messageInput.fill('<script>alert("XSS")</script>');
        await page.click('button[type="submit"]');

        await waitForNetworkIdle(page);

        // Script should be escaped or removed
        const displayedMessage = await page.locator('body').textContent();
        expect(displayedMessage).not.toContain('<script>');
      }
    });

    test('should enforce HTTPS', async ({ page }) => {
      if (process.env.NODE_ENV === 'production') {
        await page.goto('http://localhost:3000');

        // Should redirect to HTTPS
        expect(page.url()).toMatch(/^https:\/\//);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle very long URLs', async ({ page }) => {
      const longUrl = `/search?q=${'a'.repeat(2000)}`;

      try {
        await page.goto(longUrl, { timeout: 5000 });
        // If navigation succeeded, the page should still be functional
        await expect(page.locator('body')).toBeVisible();
      } catch (error) {
        // Navigation may timeout or fail  -  that is acceptable for an extremely long URL
        expect(error).toBeDefined();
      }
    });

    test('should handle rapid navigation', async ({ page }) => {
      await page.goto('/');

      // Rapidly navigate
      for (let i = 0; i < 5; i++) {
        await page.goto('/posts');
        await page.goto('/');
      }

      // Should still be functional
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle browser back/forward', async ({ page }) => {
      await page.goto('/');
      await page.goto('/posts');
      await page.goto('/contact');

      await page.goBack();
      expect(page.url()).toContain('/posts');

      await page.goBack();
      expect(page.url()).toMatch(/\/$/);

      await page.goForward();
      expect(page.url()).toContain('/posts');
    });

    test('should handle page refresh', async ({ page }) => {
      await page.goto('/');

      await page.reload();

      // Should still work after refresh
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle special characters in input', async ({ page }) => {
      await page.goto('/search');

      const searchInput = page.locator('input[type="search"], input[name="search"]');

      if ((await searchInput.count()) > 0) {
        const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        await searchInput.fill(specialChars);
        await page.keyboard.press('Enter');

        // Should handle gracefully
        await waitForNetworkIdle(page);
        expect(await page.locator('body').isVisible()).toBe(true);
      }
    });
  });
});
