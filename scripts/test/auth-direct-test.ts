#!/usr/bin/env tsx

/**
 * Direct Authentication System Test
 *
 * Tests the auth system directly (without HTTP server) to verify:
 * 1. Sign up → 2. Sign in → 3. Session management → 4. Sign out
 *
 * Usage:
 *   pnpm test:auth-direct
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	deleteSession,
	getSession,
	signIn,
	signUp,
} from "@revealui/auth/server";
import { getClient } from "@revealui/db/client";
import { sessions, users } from "@revealui/db/schema";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createLogger } from "../shared/utils.js";

const logger = createLogger();

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "../../apps/cms/.env.local") });
config({
	path: path.resolve(__dirname, "../../apps/cms/.env.development.local"),
});
config({ path: path.resolve(__dirname, "../../apps/cms/.env") });
config({ path: path.resolve(__dirname, "../../.env.local") });
config({ path: path.resolve(__dirname, "../../.env") });

interface TestResult {
	step: string;
	success: boolean;
	error?: string;
	details?: any;
}

async function cleanupTestUser(email: string): Promise<void> {
	try {
		const db = getClient();
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		if (user) {
			await db.delete(sessions).where(eq(sessions.userId, user.id));
			await db.delete(users).where(eq(users.id, user.id));
		}
	} catch (error) {
		// Ignore cleanup errors
	}
}

async function testAuthDirect(): Promise<TestResult[]> {
	const results: TestResult[] = [];
	const testEmail = `test-direct-${Date.now()}@example.com`;
	const testPassword = "TestPassword123!";
	const testName = "Test User Direct";
	let userId: string | null = null;
	let sessionToken: string | null = null;
	let sessionHeaders: Headers | null = null;

	try {
		// Step 1: Sign Up
		logger.info("\n📋 Step 1: Testing user sign up...");
		try {
			const result = await signUp(testEmail, testPassword, testName);

			if (!result.success || !result.user) {
				throw new Error(result.error || "Sign up failed");
			}

			userId = result.user.id;
			sessionToken = result.sessionToken || null;

			// Create headers for session testing
			if (sessionToken) {
				sessionHeaders = new Headers();
				sessionHeaders.set("cookie", `revealui-session=${sessionToken}`);
			}

			results.push({
				step: "Sign Up",
				success: true,
				details: { userId, email: testEmail },
			});
			logger.success("✅ Sign up successful");
		} catch (error: any) {
			results.push({
				step: "Sign Up",
				success: false,
				error: error.message || String(error),
			});
			logger.error(`❌ Sign up failed: ${error.message}`);
			return results;
		}

		// Step 2: Sign In
		logger.info("\n📋 Step 2: Testing user sign in...");
		try {
			const result = await signIn(testEmail, testPassword);

			if (!result.success || !result.user) {
				throw new Error(result.error || "Sign in failed");
			}

			sessionToken = result.sessionToken || null;

			// Update headers
			if (sessionToken) {
				sessionHeaders = new Headers();
				sessionHeaders.set("cookie", `revealui-session=${sessionToken}`);
			}

			results.push({
				step: "Sign In",
				success: true,
				details: { userId: result.user.id },
			});
			logger.success("✅ Sign in successful");
		} catch (error: any) {
			results.push({
				step: "Sign In",
				success: false,
				error: error.message || String(error),
			});
			logger.error(`❌ Sign in failed: ${error.message}`);
			return results;
		}

		// Step 3: Get Session
		logger.info("\n📋 Step 3: Testing session retrieval...");
		try {
			if (!sessionHeaders) {
				throw new Error("No session headers available");
			}

			const session = await getSession(sessionHeaders);

			if (!session) {
				throw new Error("Session retrieval failed");
			}

			results.push({
				step: "Get Session",
				success: true,
				details: {
					sessionId: session.session.id,
					userId: session.user.id,
				},
			});
			logger.success("✅ Session retrieval successful");
		} catch (error: any) {
			results.push({
				step: "Get Session",
				success: false,
				error: error.message || String(error),
			});
			logger.error(`❌ Session retrieval failed: ${error.message}`);
		}

		// Step 4: Sign Out
		logger.info("\n📋 Step 4: Testing user sign out...");
		try {
			if (!sessionHeaders) {
				throw new Error("No session headers available");
			}

			const deleted = await deleteSession(sessionHeaders);

			if (!deleted) {
				throw new Error("Sign out failed");
			}

			results.push({
				step: "Sign Out",
				success: true,
			});
			logger.success("✅ Sign out successful");
		} catch (error: any) {
			results.push({
				step: "Sign Out",
				success: false,
				error: error.message || String(error),
			});
			logger.error(`❌ Sign out failed: ${error.message}`);
		}

		// Step 5: Verify Session is Invalidated
		logger.info("\n📋 Step 5: Verifying session is invalidated...");
		try {
			if (!sessionHeaders) {
				throw new Error("No session headers available");
			}

			const session = await getSession(sessionHeaders);

			if (session) {
				throw new Error("Session should be invalidated but is still valid");
			}

			results.push({
				step: "Verify Session Invalidated",
				success: true,
			});
			logger.success("✅ Session invalidation verified");
		} catch (error: any) {
			results.push({
				step: "Verify Session Invalidated",
				success: false,
				error: error.message || String(error),
			});
			logger.error(
				`❌ Session invalidation verification failed: ${error.message}`,
			);
		}
	} catch (error: any) {
		logger.error(`\n❌ Test flow failed: ${error.message}`);
		if (error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
	} finally {
		// Cleanup test user
		if (testEmail) {
			await cleanupTestUser(testEmail);
		}
	}

	return results;
}

async function main() {
	try {
		logger.header("Direct Authentication System Test");

		// Verify database connection
		try {
			const db = getClient();
			await db.execute({ sql: "SELECT 1", args: [] });
			logger.success("Database connection verified");
		} catch (error: any) {
			logger.error(`Database connection failed: ${error.message}`);
			logger.info(
				"Make sure DATABASE_URL or POSTGRES_URL is set and database is accessible",
			);
			process.exit(1);
		}

		const results = await testAuthDirect();

		// Summary
		logger.header("Test Results Summary");
		const successCount = results.filter((r) => r.success).length;
		const totalCount = results.length;

		for (const result of results) {
			if (result.success) {
				logger.success(`✅ ${result.step}`);
				if (result.details) {
					logger.info(`   ${JSON.stringify(result.details)}`);
				}
			} else {
				logger.error(`❌ ${result.step}: ${result.error}`);
			}
		}

		logger.info("");
		logger.info(`Success: ${successCount}/${totalCount} tests passed`);

		if (successCount === totalCount) {
			logger.success("\n✅ All tests passed!");
			process.exit(0);
		} else {
			logger.error(`\n❌ ${totalCount - successCount} test(s) failed`);
			process.exit(1);
		}
	} catch (error: any) {
		logger.error(`Script failed: ${error.message}`);
		if (error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}

main();
