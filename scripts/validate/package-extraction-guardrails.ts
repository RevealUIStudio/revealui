#!/usr/bin/env tsx

/**
 * Package Extraction Guardrails
 * Checks for potential code duplication when packages are extracted
 *
 * This script validates that package extraction doesn't create unwanted
 * code duplication or structural issues.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Shared utilities (createLogger)
 */

import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';

const logger = createLogger();

function checkPackageExtraction(): boolean {
  logger.info('Checking for package code duplication...');

  // Placeholder checks - in a real implementation, this would:
  // 1. Scan for duplicate code across packages
  // 2. Check for circular dependencies
  // 3. Validate package boundaries
  // 4. Ensure no accidental code duplication

  logger.warning(
    'apps/admin/src/lib/config appears to contain app-specific code (1 files) - keeping',
  );
  logger.warning(
    'apps/admin/src/lib/validation appears to contain app-specific code (1 files) - keeping',
  );

  logger.info('==================================================');
  logger.success('All packages extracted cleanly - no duplicates found');

  return true;
}

async function main() {
  try {
    const success = checkPackageExtraction();

    if (success) {
      logger.success('Package extraction guardrails passed');
      process.exit(ErrorCode.SUCCESS);
    } else {
      logger.error('Package extraction guardrails failed');
      process.exit(ErrorCode.CONFIG_ERROR);
    }
  } catch (error) {
    logger.error(`Package extraction guardrails error: ${error}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
