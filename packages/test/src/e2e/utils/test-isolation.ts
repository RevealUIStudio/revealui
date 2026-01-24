/**
 * E2E test isolation utilities
 *
 * Provides utilities for test isolation and data cleanup
 */

import type { Page } from "@playwright/test";
import { createTestId } from "../../utils/test-helpers";

/**
 * Test context for tracking test data
 */
export interface TestContext {
	userIds: string[];
	tenantIds: string[];
	testId: string;
}

/**
 * Create isolated test context
 */
export function createTestContext(): TestContext {
	return {
		userIds: [],
		tenantIds: [],
		testId: createTestId("e2e"),
	};
}

/**
 * Cleanup test data after tests
 */
export async function cleanupTestData(
	context: TestContext,
	page: Page,
): Promise<void> {
	const baseUrl = process.env.BASE_URL || "http://localhost:3000";

	// Cleanup users if needed
	for (const userId of context.userIds) {
		try {
			// Attempt to delete test user via API if available
			await page.request.delete(`${baseUrl}/api/users/${userId}`);
		} catch (_error) {
			// Ignore cleanup errors
		}
	}
}

/**
 * Generate unique test data
 */
export function generateUniqueTestData(
	context: TestContext,
	prefix = "test",
): {
	email: string;
	password: string;
	username: string;
} {
	const uniqueId = context.testId;

	return {
		email: `${prefix}-${uniqueId}@example.com`,
		password: `TestPassword${uniqueId}!`,
		username: `${prefix}_${uniqueId}`,
	};
}

/**
 * Setup test isolation
 */
export async function setupTestIsolation(page: Page): Promise<TestContext> {
	const context = createTestContext();

	// Navigate to base URL to ensure clean state
	await page.goto(process.env.BASE_URL || "http://localhost:3000");
	await page.waitForLoadState("networkidle");

	return context;
}
