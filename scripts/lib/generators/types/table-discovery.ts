/**
 * Table Discovery Module
 *
 * Discovers table definitions from database schema files.
 * Extracted from copy-generated-types.ts for better modularity.
 *
 * @dependencies
 * - @revealui/db/types/discover - Table discovery engine
 * - scripts/lib/index.js - Logger
 *
 * @example
 * ```typescript
 * import { discoverTableMappings } from './table-discovery.js'
 *
 * const mapping = discoverTableMappings()
 * console.log(`Found ${Object.keys(mapping).length} modules`)
 * ```
 */

import { discoverTables } from '../../../../packages/db/src/types/discover.js';
import { ErrorCode, ScriptError } from '../../errors.js';
import { createLogger } from '../../index.js';

const logger = createLogger({ prefix: 'TableDiscovery' });

// =============================================================================
// Types
// =============================================================================

/**
 * Maps sub-module names to their table exports
 */
export interface TableMapping {
  [subModule: string]: string[];
}

// =============================================================================
// Discovery Functions
// =============================================================================

/**
 * Discovers which tables are exported from each sub-module
 *
 * Uses TypeScript Compiler API via discoverTables() for robust parsing.
 * Groups tables by their sourceFile (sub-module name).
 *
 * @returns TableMapping grouped by sub-module name
 *
 * @example
 * ```typescript
 * const mapping = discoverTableMappings()
 * // { agents: ['agents'], users: ['users', 'userProfiles'], ... }
 * ```
 */
export function discoverTableMappings(): TableMapping {
  const discoveryResult = discoverTables();
  const { tables, errors } = discoveryResult;

  // Log discovery errors as warnings
  if (errors.length > 0) {
    for (const error of errors) {
      const location = error.position
        ? `${error.file}:${error.position.line}:${error.position.column}`
        : error.file;
      logger.warning(
        `Table discovery warning in ${location}: ${error.message}${error.context ? ` (${error.context})` : ''}`,
      );
    }
  }

  // Group tables by their sourceFile (sub-module name)
  const mapping: TableMapping = {};

  for (const table of tables) {
    // Extract sub-module name from sourceFile (e.g., "agents.ts" -> "agents")
    // sourceFile is relative to schema directory, so it's just the filename
    const subModule = table.sourceFile.replace(/\.ts$/, '');

    if (!mapping[subModule]) {
      mapping[subModule] = [];
    }

    mapping[subModule].push(table.variableName);
  }

  // Sort tables within each sub-module for consistency
  for (const subModule in mapping) {
    mapping[subModule].sort();
  }

  return mapping;
}

/**
 * Get total count of discovered tables
 *
 * @param mapping - Table mapping
 * @returns Total number of tables
 */
export function getTotalTableCount(mapping: TableMapping): number {
  return Object.values(mapping).flat().length;
}

/**
 * Get sub-module count
 *
 * @param mapping - Table mapping
 * @returns Number of sub-modules
 */
export function getSubModuleCount(mapping: TableMapping): number {
  return Object.keys(mapping).length;
}

/**
 * Validate table mapping has tables
 *
 * @param mapping - Table mapping to validate
 * @throws Error if no tables found
 */
export function validateTableMapping(mapping: TableMapping): void {
  const totalTables = getTotalTableCount(mapping);
  const subModuleCount = getSubModuleCount(mapping);

  if (totalTables === 0) {
    const errorMessage = [
      'Failed to discover any tables from sub-modules. Cannot generate imports.',
      '',
      'Possible causes:',
      '  1. @revealui/db package is not built - run: pnpm --filter @revealui/db build',
      '  2. No pgTable exports found in packages/db/src/schema/*.ts files',
      '  3. Table discovery errors occurred (check warnings above)',
      '',
      'To fix:',
      '  - Ensure packages/db/src/schema/*.ts files contain pgTable exports',
      '  - Run: pnpm --filter @revealui/db generate:types',
      '  - Then retry this script',
    ].join('\n');
    throw new ScriptError(errorMessage, ErrorCode.NOT_FOUND);
  }

  logger.info(
    `Discovered ${totalTables} tables across ${subModuleCount} sub-module${subModuleCount !== 1 ? 's' : ''}`,
  );
}
