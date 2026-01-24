/**
 * Authentication Null Handling Tests
 *
 * Tests for handling null, undefined, and invalid authorization headers
 * Verifies that the fixes for "Cannot read properties of null (reading 'startsWith')" work correctly
 */

import type { RevealUIInstance } from "@revealui/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
	generateUniqueTestEmail,
	getTestRevealUI,
	trackTestData,
} from "../../utils/integration-helpers";

describe("Authentication Null Handling", () => {
	let revealui: RevealUIInstance;

	beforeAll(async () => {
		revealui = await getTestRevealUI();
	});

	describe("Null Authorization Header", () => {
		it("should handle null authorization header gracefully", async () => {
			// Should not throw "Cannot read properties of null (reading 'startsWith')"
			const result = await revealui.find({
				collection: "users",
				req: {
					headers: {
						authorization: null,
					},
				} as any,
			});

			// Should work without auth (if collection allows unauthenticated access)
			expect(result).toBeDefined();
			expect(result.docs).toBeDefined();
			expect(Array.isArray(result.docs)).toBe(true);
		});

		it("should handle undefined authorization header gracefully", async () => {
			const result = await revealui.find({
				collection: "users",
				req: {
					headers: {
						authorization: undefined,
					},
				} as any,
			});

			expect(result).toBeDefined();
			expect(result.docs).toBeDefined();
		});

		it("should handle missing authorization header gracefully", async () => {
			const result = await revealui.find({
				collection: "users",
				req: {
					headers: {},
				} as any,
			});

			expect(result).toBeDefined();
			expect(result.docs).toBeDefined();
		});

		it("should handle empty string authorization header gracefully", async () => {
			const result = await revealui.find({
				collection: "users",
				req: {
					headers: {
						authorization: "",
					},
				} as any,
			});

			expect(result).toBeDefined();
			expect(result.docs).toBeDefined();
		});

		it('should handle invalid format authorization header (not "JWT ...")', async () => {
			const result = await revealui.find({
				collection: "users",
				req: {
					headers: {
						authorization: "Bearer invalid-token",
					},
				} as any,
			});

			// Should not throw, but should not authenticate
			expect(result).toBeDefined();
			expect(result.docs).toBeDefined();
		});

		it("should handle findByID with null authorization header", async () => {
			const testEmail = generateUniqueTestEmail("null-auth-findbyid");

			const user = await revealui.create({
				collection: "users",
				data: {
					email: testEmail,
					password: "TestPassword123!",
					roles: ["user-admin"],
				},
			});

			trackTestData("users", String(user.id));

			// Should not throw with null authorization
			const result = await revealui.findByID({
				collection: "users",
				id: user.id,
				req: {
					headers: {
						authorization: null,
					},
				} as any,
			});

			expect(result).toBeDefined();
			expect(result?.id).toBe(user.id);
		});

		it("should handle findByID with undefined authorization header", async () => {
			const testEmail = generateUniqueTestEmail("undefined-auth-findbyid");

			const user = await revealui.create({
				collection: "users",
				data: {
					email: testEmail,
					password: "TestPassword123!",
					roles: ["user-admin"],
				},
			});

			trackTestData("users", String(user.id));

			const result = await revealui.findByID({
				collection: "users",
				id: user.id,
				req: {
					headers: {
						authorization: undefined,
					},
				} as any,
			});

			expect(result).toBeDefined();
			expect(result?.id).toBe(user.id);
		});

		it("should handle findByID with empty string authorization header", async () => {
			const testEmail = generateUniqueTestEmail("empty-auth-findbyid");

			const user = await revealui.create({
				collection: "users",
				data: {
					email: testEmail,
					password: "TestPassword123!",
					roles: ["user-admin"],
				},
			});

			trackTestData("users", String(user.id));

			const result = await revealui.findByID({
				collection: "users",
				id: user.id,
				req: {
					headers: {
						authorization: "",
					},
				} as any,
			});

			expect(result).toBeDefined();
			expect(result?.id).toBe(user.id);
		});
	});

	describe("Valid Authorization Header", () => {
		it("should handle valid JWT authorization header", async () => {
			const testEmail = generateUniqueTestEmail("valid-auth");

			const user = await revealui.create({
				collection: "users",
				data: {
					email: testEmail,
					password: "TestPassword123!",
					roles: ["user-admin"],
				},
			});

			trackTestData("users", String(user.id));

			// Login to get valid token
			const loginResult = await revealui.login({
				collection: "users",
				data: {
					email: testEmail,
					password: "TestPassword123!",
				},
			});

			// Should work with valid JWT token
			const result = await revealui.find({
				collection: "users",
				where: {
					email: {
						equals: testEmail,
					},
				},
				req: {
					headers: {
						authorization: `JWT ${loginResult.token}`,
					},
				} as any,
			});

			expect(result.docs.length).toBeGreaterThan(0);
			expect(result.docs[0].email).toBe(testEmail);
		});
	});
});
