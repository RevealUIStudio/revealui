#!/usr/bin/env tsx

/**
 * Reference Validation Script
 *
 * Validates internal links and references in documentation:
 * - Internal links resolve correctly
 * - File targets exist
 * - Anchors exist in target files
 * - References to archived/deleted files are flagged
 *
 * Usage:
 *   pnpm docs:check:references [--dry-run] [--verbose]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createLogger, getProjectRoot } from "../shared/utils.js";
import {
	generateReportMarkdown,
	validateAllReferences,
} from "./validate-references-core.js";

const logger = createLogger();

// Parse command line arguments
function parseArgs(args: string[]): { dryRun: boolean; verbose: boolean } {
	let dryRun = false;
	let verbose = false;

	for (const arg of args) {
		if (arg === "--dry-run" || arg === "--dryrun") {
			dryRun = true;
		} else if (arg === "--verbose" || arg === "-v") {
			verbose = true;
		}
	}

	return { dryRun, verbose };
}

async function main() {
	const { dryRun, verbose } = parseArgs(process.argv.slice(2));

	if (dryRun) {
		logger.info("🔍 [DRY RUN] Validating documentation references...");
	} else {
		logger.info("🔍 Validating documentation references...");
	}

	try {
		const report = await validateAllReferences(logger);

		const projectRoot = getProjectRoot();
		const reportDir = path.join(projectRoot, "docs", "reports");

		if (dryRun) {
			logger.info("[DRY RUN] Would generate report in:", reportDir);
			logger.info(`   Total files: ${report.totalFiles}`);
			logger.info(`   Broken references: ${report.brokenReferences.length}`);
			logger.info(`   Errors: ${report.summary.errors}`);
			logger.info(`   Warnings: ${report.summary.warnings}`);

			if (report.summary.errors > 0) {
				logger.error(
					`❌ [DRY RUN] Would fail with ${report.summary.errors} broken references`,
				);
			} else if (report.summary.warnings > 0) {
				logger.warn(
					`⚠️  [DRY RUN] Would warn about ${report.summary.warnings} warnings`,
				);
			} else {
				logger.info("✅ [DRY RUN] No broken references found!");
			}

			if (verbose) {
				logger.info("\n[DRY RUN] Report preview:");
				const preview = generateReportMarkdown(report);
				logger.info(
					preview.substring(0, 500) + (preview.length > 500 ? "..." : ""),
				);
			}
			return;
		}

		await fs.mkdir(reportDir, { recursive: true });

		const reportPath = path.join(reportDir, "broken-references.md");
		const markdown = generateReportMarkdown(report);
		await fs.writeFile(reportPath, markdown, "utf-8");

		logger.info(`✅ Report generated: ${reportPath}`);
		logger.info(`   Total files: ${report.totalFiles}`);
		logger.info(`   Broken references: ${report.brokenReferences.length}`);
		logger.info(`   Errors: ${report.summary.errors}`);
		logger.info(`   Warnings: ${report.summary.warnings}`);

		if (report.summary.errors > 0) {
			logger.error(`❌ Found ${report.summary.errors} broken references`);
			process.exit(1);
		} else if (report.summary.warnings > 0) {
			logger.warn(`⚠️  Found ${report.summary.warnings} warnings`);
		} else {
			logger.info("✅ No broken references found!");
		}
	} catch (error) {
		if (error instanceof Error) {
			logger.error(`❌ Error validating references: ${error.message}`);
			if (verbose && error.stack) {
				logger.error(`Stack trace: ${error.stack}`);
			}
		} else {
			logger.error("❌ Error validating references: Unknown error");
			if (verbose) {
				logger.error(`Error object: ${JSON.stringify(error)}`);
			}
		}
		process.exit(1);
	}
}

main();
