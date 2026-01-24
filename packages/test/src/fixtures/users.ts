/**
 * User test fixtures
 *
 * Provides test data for user-related tests
 */

import { createTestId } from "../utils/test-helpers";

export interface TestUser {
	id: string;
	email: string;
	password: string;
	name?: string;
	role?: "admin" | "user" | "guest";
	tenantId?: string;
}

/**
 * Create a test user with unique email
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
	const testId = createTestId("user");

	return {
		id: overrides?.id || `user_${testId}`,
		email: overrides?.email || `test-${testId}@example.com`,
		password: overrides?.password || "TestPassword123!",
		name: overrides?.name || `Test User ${testId}`,
		role: overrides?.role || "user",
		tenantId: overrides?.tenantId || `tenant_${testId}`,
		...overrides,
	};
}

/**
 * Create an admin test user
 */
export function createAdminUser(overrides?: Partial<TestUser>): TestUser {
	return createTestUser({
		role: "admin",
		email: `admin-${createTestId()}@example.com`,
		...overrides,
	});
}

/**
 * Create multiple test users
 */
export function createTestUsers(
	count: number,
	overrides?: Partial<TestUser>,
): TestUser[] {
	return Array.from({ length: count }, () => createTestUser(overrides));
}

/**
 * Default test users for common scenarios
 */
export const defaultTestUsers = {
	admin: {
		id: "user_admin_test",
		email: "admin@test.example.com",
		password: "AdminPassword123!",
		role: "admin" as const,
		name: "Admin User",
	},
	regular: {
		id: "user_regular_test",
		email: "user@test.example.com",
		password: "UserPassword123!",
		role: "user" as const,
		name: "Regular User",
	},
	guest: {
		id: "user_guest_test",
		email: "guest@test.example.com",
		password: "GuestPassword123!",
		role: "guest" as const,
		name: "Guest User",
	},
};
