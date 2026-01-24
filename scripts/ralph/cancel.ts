#!/usr/bin/env tsx
/**
 * Cancel Ralph-inspired iterative workflow
 */

import { createLogger, getProjectRoot } from "../shared/utils.js";
import { cleanupWorkflow, isWorkflowActive, readStateFile } from "./utils.js";

const logger = createLogger();

/**
 * Main function
 */
async function main() {
	const projectRoot = await getProjectRoot(import.meta.url);

	// Check if workflow is active
	if (!(await isWorkflowActive(projectRoot))) {
		logger.info("No active workflow to cancel");
		process.exit(0);
	}

	try {
		// Read state file to show info
		const stateFile = await readStateFile(projectRoot);
		logger.info(
			`Cancelling workflow (iteration ${stateFile.frontmatter.iteration})...`,
		);

		// Cleanup
		await cleanupWorkflow(projectRoot);

		logger.success("Workflow cancelled successfully");
	} catch (error) {
		// Even if read fails, try to cleanup
		logger.warning(
			`Failed to read state file: ${error instanceof Error ? error.message : String(error)}`,
		);
		logger.info("Attempting cleanup anyway...");

		try {
			await cleanupWorkflow(projectRoot);
			logger.success("Workflow cancelled (files cleaned up)");
		} catch (cleanupError) {
			logger.error(
				`Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
			);
			logger.info(
				"You may need to manually delete files in .cursor/ directory",
			);
			process.exit(1);
		}
	}
}

main().catch((error) => {
	logger.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
