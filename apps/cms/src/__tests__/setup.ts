/**
 * Test setup file
 * Runs before all tests to configure test environment
 */

import { vi } from "vitest";

// Set test environment variables
Object.assign(process.env, {
	NODE_ENV: "test",
	PAYLOAD_SECRET: "test-secret-key-for-testing-only-32chars",
	PAYLOAD_PUBLIC_SERVER_URL: "http://localhost:4000",
	// Force SQLite for tests to avoid Postgres dependency issues
	POSTGRES_URL: "",
	SUPABASE_DATABASE_URI: "",
	DATABASE_URL: "",
});

// Mock console methods to reduce test output noise
global.console = {
	...console,
	log: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	// Keep warn and error for debugging tests
};

/**
 * Global test utilities and mocks
 */

// Mock Next.js router
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		prefetch: vi.fn(),
	}),
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js headers
vi.mock("next/headers", () => ({
	cookies: () => ({
		get: vi.fn((name: string) => ({ value: "mock-token" })),
		set: vi.fn(),
		delete: vi.fn(),
	}),
	headers: () => ({
		get: vi.fn(),
		set: vi.fn(),
	}),
}));

/**
 * Test helpers
 */

export const mockUser = {
	id: 1,
	email: "test@example.com",
	roles: ["user-admin"],
	lastLoggedInTenant: 1,
};

export const mockSuperAdmin = {
	id: 2,
	email: "superadmin@example.com",
	roles: ["user-super-admin"],
};

export const mockTenant = {
	id: 1,
	name: "Test Tenant",
	url: "https://test-tenant.example.com",
};
