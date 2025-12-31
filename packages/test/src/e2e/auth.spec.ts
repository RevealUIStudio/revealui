import { expect, test } from "@playwright/test";

/**
 * Authentication E2E Tests
 * Tests user registration, login, and admin panel access
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:4000";

test.describe("User Authentication", () => {
	test("user can register new account", async ({ page }) => {
		await page.goto(`${BASE_URL}/register`);

		// Fill registration form
		await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
		await page.fill('input[name="password"]', "TestPassword123!");
		await page.fill('input[name="confirmPassword"]', "TestPassword123!");

		// Submit form
		await page.click('button[type="submit"]');

		// Should redirect to login or dashboard
		await expect(page).toHaveURL(
			new RegExp(`${BASE_URL}/(login|dashboard|admin)`),
		);
	});

	test("user can login with valid credentials", async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		// Fill login form
		await page.fill('input[name="email"]', "admin@example.com");
		await page.fill('input[name="password"]', "password");

		// Submit form
		await page.click('button[type="submit"]');

		// Should redirect to admin or dashboard
		await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(admin|dashboard)`));
	});

	test("user cannot login with invalid credentials", async ({ page }) => {
		await page.goto(`${BASE_URL}/login`);

		await page.fill('input[name="email"]', "invalid@example.com");
		await page.fill('input[name="password"]', "wrongpassword");

		await page.click('button[type="submit"]');

		// Should show error message or stay on login page
		const errorVisible = await page
			.locator("text=/invalid|error|incorrect/i")
			.isVisible()
			.catch(() => false);
		const stillOnLogin = page.url().includes("/login");

		expect(errorVisible || stillOnLogin).toBe(true);
	});

	test("user can logout", async ({ page }) => {
		// First login
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="email"]', "admin@example.com");
		await page.fill('input[name="password"]', "password");
		await page.click('button[type="submit"]');

		// Wait for redirect
		await page.waitForURL(new RegExp(`${BASE_URL}/(admin|dashboard)`));

		// Find and click logout button
		const logoutButton = page
			.locator(
				'button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]',
			)
			.first();
		if (await logoutButton.isVisible().catch(() => false)) {
			await logoutButton.click();

			// Should redirect to login or home
			await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(login|/)$`));
		}
	});
});

test.describe("Admin Panel Access", () => {
	test("admin can access admin panel", async ({ page }) => {
		// Login first
		await page.goto(`${BASE_URL}/login`);
		await page.fill('input[name="email"]', "admin@example.com");
		await page.fill('input[name="password"]', "password");
		await page.click('button[type="submit"]');

		// Navigate to admin
		await page.goto(`${BASE_URL}/admin`);

		// Should load admin panel
		await expect(page).toHaveURL(new RegExp(`${BASE_URL}/admin`));

		// Check for admin panel elements
		const adminElements = page
			.locator('nav, [role="navigation"], header')
			.first();
		await expect(adminElements).toBeVisible();
	});

	test("non-admin cannot access admin panel", async ({ page }) => {
		// Try to access admin without login
		const response = await page.goto(`${BASE_URL}/admin`);

		// Should redirect to login or show 403
		expect([200, 302, 307, 403]).toContain(response?.status() || 200);

		if (response?.status() === 200) {
			// If page loads, should show login form or access denied
			const loginForm = page.locator('input[name="email"]');
			const accessDenied = page.locator("text=/access denied|forbidden|403/i");

			const hasLogin = await loginForm.isVisible().catch(() => false);
			const hasDenied = await accessDenied.isVisible().catch(() => false);

			expect(hasLogin || hasDenied).toBe(true);
		}
	});
});
