/**
 * Full-Stack E2E Tests
 *
 * Comprehensive tests that verify the complete user experience flow:
 * Browser Interaction → API Calls → Database Operations
 *
 * These tests verify that user actions in the browser correctly
 * propagate through the API layer and result in expected database changes.
 */

import { expect, test } from '@playwright/test';
import {
  cleanupTestData,
  createTestDb,
  type DbTestHelper,
  waitForDbRecord,
} from './utils/db-helpers';
import { fillField, waitForApiResponse, waitForNetworkIdle } from './utils/test-helpers';

test.describe('Full-Stack User Flows', () => {
  let db: DbTestHelper;

  test.beforeAll(async () => {
    // Initialize database connection
    db = createTestDb();
    await db.connect();
  });

  test.afterAll(async () => {
    // Clean up database connection
    await db.disconnect();
  });

  test.describe('User Registration Flow', () => {
    const testEmail = `test-${Date.now()}@example.com`;

    test.afterEach(async () => {
      // Clean up test user
      await cleanupTestData(db, 'users', {
        column: 'email',
        value: testEmail,
      });
    });

    test('should create user in database when signing up from browser', async ({ page }) => {
      // 1. Navigate to signup page
      await page.goto('/signup');
      await waitForNetworkIdle(page);

      // 2. Fill out signup form
      await fillField(page, 'input[name="email"]', testEmail);
      await fillField(page, 'input[name="password"]', 'SecurePassword123!');
      await fillField(page, 'input[name="name"]', 'Test User');

      // 3. Wait for API response
      const responsePromise = waitForApiResponse(page, '/api/auth/signup', 'POST');

      // 4. Submit form
      await page.click('button[type="submit"]');

      // 5. Wait for API call to complete
      const response = await responsePromise;
      expect(response.status()).toBe(200);

      // 6. Verify user was created in database
      const user = await waitForDbRecord<{ id: string; email: string; name: string }>(db, 'users', {
        column: 'email',
        value: testEmail,
      });

      expect(user).toBeTruthy();
      expect(user?.email).toBe(testEmail);
      expect(user?.name).toBe('Test User');

      // 7. Verify UI shows success
      await expect(page).toHaveURL(/\/(dashboard|home)/);

      // 8. Take screenshot for visual verification
      await page.screenshot({
        path: 'test-results/full-stack/user-registration-success.png',
        fullPage: true,
      });
    });

    test('should not create user in database with invalid email', async ({ page }) => {
      await page.goto('/signup');

      // Get initial user count
      const initialCount = await db.count('users');

      // Try to sign up with invalid email
      await fillField(page, 'input[name="email"]', 'invalid-email');
      await fillField(page, 'input[name="password"]', 'SecurePassword123!');
      await page.click('button[type="submit"]');

      // Wait a bit for any potential requests
      await page.waitForTimeout(1000);

      // Verify user count hasn't changed
      const finalCount = await db.count('users');
      expect(finalCount).toBe(initialCount);

      // Verify error message shown
      await expect(page.locator('text=/invalid.*email/i').first()).toBeVisible();
    });
  });

  test.describe('Transaction Flow', () => {
    test('should rollback database changes on error', async ({ page }) => {
      // This test verifies that failed operations don't leave partial data

      // 1. Get initial counts
      const initialUserCount = await db.count('users');
      const initialPostCount = await db.count('posts');

      // 2. Navigate to a form that creates multiple related records
      await page.goto('/signup-with-profile');

      // 3. Fill form with data that will cause an error
      await fillField(page, 'input[name="email"]', 'test@example.com');
      await fillField(page, 'input[name="password"]', 'short'); // Too short

      // 4. Submit form
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      // 5. Verify counts haven't changed (transaction rolled back)
      const finalUserCount = await db.count('users');
      const finalPostCount = await db.count('posts');

      expect(finalUserCount).toBe(initialUserCount);
      expect(finalPostCount).toBe(initialPostCount);

      // 6. Verify error message shown
      await expect(page.locator('[role="alert"]')).toBeVisible();
    });
  });
});
