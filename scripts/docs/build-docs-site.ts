#!/usr/bin/env tsx

/**
 * Documentation Site Build Script
 *
 * Builds the TanStack Start documentation website.
 *
 * Usage:
 *   pnpm docs:generate:site
 */

import { createLogger, execCommand, getProjectRoot } from "../shared/utils.js";

const logger = createLogger();

async function buildDocsSite(): Promise<void> {
	const projectRoot = await getProjectRoot(import.meta.url);

	logger.header("Documentation Site Build");

	logger.info("Building TanStack Start documentation site...\n");

	const result = await execCommand("pnpm", ["--filter", "docs", "build"], {
		cwd: projectRoot,
	});

	if (result.success) {
		logger.success("✅ Documentation site built successfully!");
	} else {
		logger.error(`❌ Build failed: ${result.message}`);
		process.exit(1);
	}
}

async function main() {
	try {
		await buildDocsSite();
	} catch (error) {
		logger.error(
			`Script failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		if (error instanceof Error && error.stack) {
			logger.error(`Stack trace: ${error.stack}`);
		}
		process.exit(1);
	}
}

main();
