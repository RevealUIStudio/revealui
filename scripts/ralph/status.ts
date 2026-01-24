#!/usr/bin/env tsx
/**
 * Check status of Ralph-inspired iterative workflow
 */

import { createLogger, getProjectRoot } from "../shared/utils.js";
import {
	isWorkflowActive,
	readCompletionMarker,
	readStateFile,
	validateStateFile,
} from "./utils.js";

const logger = createLogger();

/**
 * Main function
 */
async function _main() {
	const projectRoot = await getProjectRoot(import.meta.url);

	// Check if workflow is active
	if (!(await isWorkflowActive(projectRoot))) {
		logger.info("No active workflow");
		logger.info('Run "pnpm ralph:start" to begin a workflow');
		process.exit(0);
	}

	try {
		// Read state file
		const stateFile = await readStateFile(projectRoot);

		// Validate state file
		const validation = await validateStateFile(projectRoot);
		if (!validation.valid) {
			logger.error("State file validation failed:");
			for (const error of validation.errors) {
				logger.error(`  - ${error}`);
			}
			logger.info('Run "pnpm ralph:cancel" to reset the workflow');
			process.exit(1);
		}

		logger.header("Ralph Workflow Status");

		const state = stateFile.frontmatter;

		// Show basic info
		logger.info(
			`Iteration: ${state.iteration}${state.max_iterations > 0 ? ` / ${state.max_iterations}` : " (unlimited)"}`,
		);
		logger.info(`Started: ${state.started_at}`);
		logger.info(
			`Prompt: ${stateFile.prompt.slice(0, 60)}${stateFile.prompt.length > 60 ? "..." : ""}`,
		);

		// Show completion promise
		if (state.completion_promise) {
			logger.info(`Completion promise: ${state.completion_promise}`);

			// Check completion marker
			const markerContent = await readCompletionMarker(projectRoot);
			if (markerContent) {
				if (markerContent === state.completion_promise) {
					logger.success("Completion marker detected (matches promise)");
					logger.info('Run "pnpm ralph:continue" to finalize and cleanup');
				} else {
					logger.warning(
						`Completion marker found but doesn't match (marker: "${markerContent}", expected: "${state.completion_promise}")`,
					);
				}
			} else {
				logger.info("Completion marker not found (workflow not complete)");
			}
		} else {
			logger.info(
				"No completion promise set (workflow runs until manually cancelled)",
			);
		}

		// Check max iterations
		if (state.max_iterations > 0 && state.iteration >= state.max_iterations) {
			logger.warning(`Max iterations (${state.max_iterations}) reached`);
			logger.info('Run "pnpm ralph:continue" to finalize and cleanup');
		}

		logger.info("");
		logger.info("Next steps:");
		logger.info("  - Continue iteration: pnpm ralph:continue");
		logger.info("  - Cancel workflow: pnpm ralph:cancel");
	} catch (error) {
		logger.error(
			`Failed to read state file: ${error instanceof Error ? error.message : String(error)}`,
		);
		logger.info('Run "pnpm ralph:cancel" to reset the workflow');
		process.exit(1);
	}
}

/**
 * Main function
 */
async function main() {
	try {
		await runStatus();
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
