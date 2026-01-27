#!/usr/bin/env node
/**
 * Neon HTTP Connection Test
 *
 * Tests actual connection to Neon database using Drizzle/Neon HTTP driver.
 * This is used by validate-production.sh to verify connectivity.
 */

import {createLogger} from "../../../packages/core/src/.scripts/utils.ts";
import {createClient} from "../packages/db/client/index.ts";

const logger = createLogger();
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
	logger.error("POSTGRES_URL or DATABASE_URL must be set");
	process.exit(1);
}

try {
	const db = createClient({ connectionString: POSTGRES_URL });

	// Test connection with a simple query
	const result = await db.execute({
		sql: "SELECT 1 as test, NOW() as timestamp",
		params: [],
	});

	// Handle different result formats
	const rows = Array.isArray(result) ? result : result?.rows || [];

	if (rows.length > 0) {
		logger.success("Connection verified");
		logger.info(`Test result: ${JSON.stringify(rows[0])}`);
		process.exit(0);
	} else {
		logger.error("Query returned no results");
		process.exit(1);
	}
} catch (error) {
	logger.error(
		`Connection failed: ${error instanceof Error ? error.message : String(error)}`,
	);
	if (error instanceof Error && error.stack) {
		logger.error(`Stack trace: ${error.stack}`);
	}
	process.exit(1);
}
