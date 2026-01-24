/**
 * Test hooks utilities
 *
 * Provides Vitest/Playwright hooks for setup/teardown and automatic cleanup
 */

import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { clearAllMocks } from "../mocks";
import {
	cleanupTestData,
	resetTestState,
	setupTestDatabase,
} from "./integration-helpers";

/**
 * Setup test hooks for unit tests
 */
export function setupUnitTestHooks(): void {
	beforeEach(() => {
		// Clear mocks before each test
		clearAllMocks();
	});
}

/**
 * Setup test hooks for integration tests
 */
export function setupIntegrationTestHooks(): void {
	beforeAll(async () => {
		await setupTestDatabase();
	});

	afterAll(async () => {
		await resetTestState();
	});

	beforeEach(async () => {
		await cleanupTestData();
	});

	afterEach(async () => {
		await cleanupTestData();
		clearAllMocks();
	});
}

/**
 * Setup test hooks for E2E tests (Playwright)
 */
export function setupE2ETestHooks(): {
	beforeEach: (callback: () => Promise<void>) => void;
	afterEach: (callback: () => Promise<void>) => void;
} {
	// These would be used in Playwright test files
	// Example usage:
	// test.beforeEach(async ({ page }) => {
	//   await setupE2ETestHooks().beforeEach(async () => {
	//     // Setup code
	//   })
	// })

	return {
		beforeEach: async (callback: () => Promise<void>) => {
			await callback();
		},
		afterEach: async (callback: () => Promise<void>) => {
			await callback();
			clearAllMocks();
		},
	};
}

/**
 * Automatic cleanup utility
 */
export async function automaticCleanup(): Promise<void> {
	await cleanupTestData();
	clearAllMocks();
}

/**
 * Test isolation enforcement
 */
export function enforceTestIsolation(): void {
	// Ensure tests don't share state
	beforeEach(() => {
		// Clear any global state
		clearAllMocks();
	});

	afterEach(() => {
		// Cleanup after each test
		clearAllMocks();
	});
}
