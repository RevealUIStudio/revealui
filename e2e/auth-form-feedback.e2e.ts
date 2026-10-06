/**
 * Admin login and signup inline feedback.
 *
 * Requires apps/admin. Skips when the admin health check is unreachable.
 * Does not create an account or submit a real sign-in.
 */

import { expect, test } from '@playwright/test';

const ADMIN_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4000';

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${ADMIN_BASE}/api/health`, { timeout: 3000 });
    if (!res.ok()) test.skip();
  } catch {
    test.skip();
  }
});

test.describe('auth form feedback', () => {
  test('login shows site messages for empty and malformed email', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/login`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#password')).toHaveAttribute('aria-invalid', 'true');

    await page.locator('#email').fill('not-an-email');
    await page.locator('#password').fill('Password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email format')).toBeVisible();
  });

  test('signup checklist and sign-in link keep each plan', async ({ page }) => {
    await page.goto(`${ADMIN_BASE}/signup`);
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    await expect(page.getByText('Password must be at least 12 characters long')).toBeVisible();
    await expect(page.getByText('at least 8 characters')).toHaveCount(0);

    await page.locator('#password').fill('password1234');
    await expect(
      page.getByText('Password must contain at least one uppercase letter'),
    ).toBeVisible();

    for (const plan of ['pro', 'max', 'enterprise'] as const) {
      await page.goto(`${ADMIN_BASE}/signup?plan=${plan}`);
      await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
        'href',
        `/login?plan=${plan}`,
      );
    }

    await page.goto(`${ADMIN_BASE}/signup?plan=pro&license=pro&redirect=/welcome`);
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?plan=pro&license=pro&redirect=%2Fwelcome',
    );

    await page.goto(`${ADMIN_BASE}/signup?plan=pro&redirect=https://evil.example/phish`);
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?plan=pro',
    );

    await page.goto(`${ADMIN_BASE}/login?plan=max&license=pro&redirect=/welcome`);
    await expect(page.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup?plan=max&license=pro&redirect=%2Fwelcome',
    );

    await page.goto(`${ADMIN_BASE}/login?plan=pro&redirect=//evil.com`);
    await expect(page.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup?plan=pro',
    );
  });
});
