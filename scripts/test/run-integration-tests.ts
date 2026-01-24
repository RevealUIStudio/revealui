/**
 * Run Integration Tests
 *
 * Runs integration tests with proper database configuration.
 * Automatically provisions test database if POSTGRES_URL is not set.
 */

import { execSync } from "child_process";
import { config } from "dotenv";
import { resolve } from "path";
import { setupTestDatabase } from "./setup-test-database.js";
import { teardownTestDatabase } from "./teardown-test-database.js";

// Load environment variables
config({ path: resolve(__dirname, "../../apps/cms/.env.local") });
config({ path: resolve(__dirname, "../../apps/cms/.env.development.local") });
config({ path: resolve(__dirname, "../../apps/cms/.env") });
config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

const logger = {
	info: (msg: string) => console.log(`ℹ️  ${msg}`),
	success: (msg: string) => console.log(`✅ ${msg}`),
	error: (msg: string) => console.error(`❌ ${msg}`),
	warn: (msg: string) => console.warn(`⚠️  ${msg}`),
};

async function runIntegrationTests() {
	let databaseSetup: Awaited<ReturnType<typeof setupTestDatabase>> | null =
		null;
	let databaseUrl: string | undefined =
		process.env.DATABASE_URL || process.env.POSTGRES_URL;

	try {
		// Auto-provision database if not set
		if (!databaseUrl) {
			logger.info("No database URL found, provisioning test database...");
			databaseSetup = await setupTestDatabase();
			databaseUrl = databaseSetup.connectionString;
			process.env.TEST_DB_TYPE = databaseSetup.type;
		} else {
			logger.info(
				`Using existing database: ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`,
			);
		}

		// Set environment variables for tests
		process.env.DATABASE_URL = databaseUrl;
		process.env.POSTGRES_URL = databaseUrl;

		logger.info("Running integration tests...\n");

		// Run tests for all packages with integration tests
		const testPackages = ["@revealui/auth", "@revealui/ai"];

		for (const packageName of testPackages) {
			logger.info(`Running tests for ${packageName}...`);
			try {
				execSync(`pnpm --filter ${packageName} test`, {
					stdio: "inherit",
					cwd: resolve(__dirname, "../.."),
					env: {
						...process.env,
						DATABASE_URL: databaseUrl,
						POSTGRES_URL: databaseUrl,
					},
				});
				logger.success(`Tests passed for ${packageName}`);
			} catch (error) {
				logger.error(`Tests failed for ${packageName}`);
				throw error;
			}
		}

		logger.success("\n✅ All integration tests completed");
	} catch (error) {
		logger.error(
			`\n❌ Integration tests failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	} finally {
		// Cleanup test database if we provisioned it
		if (databaseSetup && databaseSetup.cleanup) {
			logger.info("Cleaning up test database...");
			try {
				await databaseSetup.cleanup();
			} catch (error) {
				logger.warn(
					`Cleanup error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} else if (databaseSetup) {
			// Use teardown script for non-docker setups
			await teardownTestDatabase({
				type: databaseSetup.type,
				connectionString: databaseSetup.connectionString,
			});
		}
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runIntegrationTests()
		.then(() => {
			process.exit(0);
		})
		.catch(() => {
			process.exit(1);
		});
}

export { runIntegrationTests };
