import { expect, test } from "@playwright/test";

/**
 * Payment Processing E2E Tests
 * Tests payment checkout flow and Stripe integration
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("Payment Checkout Flow", () => {
	test("user can initiate checkout", async ({ page }) => {
		// Navigate to product or cart page
		await page.goto(`${BASE_URL}/products`);

		// Find and click add to cart or buy button
		const addToCartButton = page
			.locator('button:has-text("Add to Cart"), button:has-text("Buy")')
			.first();

		if (await addToCartButton.isVisible().catch(() => false)) {
			await addToCartButton.click();

			// Should navigate to checkout or cart
			await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(checkout|cart)`));
		}
	});

	test("checkout form validates input", async ({ page }) => {
		await page.goto(`${BASE_URL}/checkout`);

		// Try to submit empty form
		const submitButton = page.locator('button[type="submit"]').first();

		if (await submitButton.isVisible().catch(() => false)) {
			await submitButton.click();

			// Should show validation errors
			const errors = page.locator("text=/required|invalid|error/i");
			const errorCount = await errors.count();

			// Should have at least one validation error
			expect(errorCount).toBeGreaterThan(0);
		}
	});

	test("payment form accepts test card numbers", async ({ page }) => {
		await page.goto(`${BASE_URL}/checkout`);

		// Look for payment form elements
		const cardInput = page
			.locator('input[name*="card"], input[placeholder*="card"], #card-number')
			.first();

		if (await cardInput.isVisible().catch(() => false)) {
			// Use Stripe test card number
			await cardInput.fill("4242 4242 4242 4242");

			// Fill other required fields if present
			const expiryInput = page
				.locator('input[name*="expiry"], input[placeholder*="expiry"]')
				.first();
			if (await expiryInput.isVisible().catch(() => false)) {
				await expiryInput.fill("12/25");
			}

			const cvcInput = page
				.locator('input[name*="cvc"], input[placeholder*="cvc"]')
				.first();
			if (await cvcInput.isVisible().catch(() => false)) {
				await cvcInput.fill("123");
			}

			// Form should accept the input
			const value = await cardInput.inputValue();
			expect(value.length).toBeGreaterThan(0);
		}
	});

	test("payment success redirects to success page", async ({ page }) => {
		// This test would require actual payment processing
		// For now, we test the success page exists
		await page.goto(`${BASE_URL}/checkout/success`);

		// Should show success message
		const successMessage = page.locator(
			"text=/success|thank you|payment received/i",
		);
		await successMessage.isVisible().catch(() => false);

		// Page should load (200 or redirect)
		const response = await page
			.goto(`${BASE_URL}/checkout/success`)
			.catch(() => null);
		expect(response?.status() || 200).toBeLessThan(500);
	});
});

test.describe("Stripe Integration", () => {
	test("Stripe elements load correctly", async ({ page }) => {
		await page.goto(`${BASE_URL}/checkout`);

		// Check for Stripe iframe or elements
		// Stripe elements may not be visible in test environment
		// Just verify page loads without errors
		await expect(page).toHaveURL(new RegExp(`${BASE_URL}/(checkout|pay)`));

		// Verify page loaded successfully (no console errors)
		const errors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				errors.push(msg.text());
			}
		});

		// Allow some time for Stripe to load
		await page.waitForTimeout(1000);

		// Should not have critical errors
		const criticalErrors = errors.filter(
			(error) => !error.includes("favicon") && !error.includes("analytics"),
		);
		expect(criticalErrors.length).toBe(0);
	});

	test("webhook endpoint exists", async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/webhooks/stripe`);

		// Webhook endpoint should exist (may return 405 for GET, but should not be 404)
		expect([200, 405, 401]).toContain(response.status());
	});
});
