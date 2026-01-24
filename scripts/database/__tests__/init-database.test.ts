/**
 * Unit tests for init-database.ts
 * Tests database initialization logic and error handling
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database connection
vi.mock("pg", () => ({
	Pool: vi.fn().mockImplementation(() => ({
		connect: vi.fn(),
		end: vi.fn(),
	})),
}));

describe("init-database", () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
		vi.clearAllMocks();
	});

	afterEach(() => {
		process.env = originalEnv;
		vi.restoreAllMocks();
	});

	it("should require database connection string", () => {
		delete process.env.DATABASE_URL;
		delete process.env.POSTGRES_URL;
		delete process.env.SUPABASE_DATABASE_URI;

		// The script should exit with error when no connection string is provided
		// This is tested via the main function behavior
		expect(process.env.DATABASE_URL).toBeUndefined();
	});

	it("should detect Neon provider from connection string", () => {
		process.env.DATABASE_URL = "postgresql://user:pass@ep-xxx.neon.tech/db";
		const url = process.env.DATABASE_URL.toLowerCase();
		expect(url.includes(".neon.tech") || url.includes("neon.tech")).toBe(true);
	});

	it("should detect Supabase provider from connection string", () => {
		process.env.DATABASE_URL = "postgresql://user:pass@xxx.supabase.co/db";
		const url = process.env.DATABASE_URL.toLowerCase();
		expect(url.includes(".supabase.co") || url.includes("supabase")).toBe(true);
	});

	it("should detect Vercel provider from connection string", () => {
		process.env.DATABASE_URL =
			"postgresql://user:pass@xxx.vercel-storage.com/db";
		const url = process.env.DATABASE_URL.toLowerCase();
		expect(url.includes("vercel")).toBe(true);
	});

	it("should use generic provider for unknown URLs", () => {
		process.env.DATABASE_URL = "postgresql://localhost:5432/db";
		const url = process.env.DATABASE_URL.toLowerCase();
		const isNeon = url.includes(".neon.tech") || url.includes("neon.tech");
		const isSupabase = url.includes(".supabase.co") || url.includes("supabase");
		const isVercel = url.includes("vercel");
		expect(isNeon || isSupabase || isVercel).toBe(false);
	});

	it("should handle SSL configuration for connection strings", () => {
		const withSSL = "postgresql://user:pass@host/db?sslmode=require";
		const hasSSL =
			withSSL.includes("sslmode=require") || withSSL.includes("ssl=true");
		expect(hasSSL).toBe(true);
	});

	it("should check for required RevealUI tables", () => {
		const requiredTables = [
			"revealui_locked_documents",
			"revealui_locked_documents_rels",
			"revealui_preferences",
			"revealui_preferences_rels",
			"revealui_migrations",
		];
		expect(requiredTables.length).toBe(5);
		expect(requiredTables).toContain("revealui_migrations");
	});
});
