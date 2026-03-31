#!/usr/bin/env tsx
/**
 * Contract Wrapper Generator
 *
 * Generates Contract wrappers for all auto-generated Zod schemas.
 * Contracts provide a unified interface combining TypeScript types,
 * Zod schemas, and runtime validation.
 *
 * Generated contracts include:
 * - RowContract: For database row types
 * - InsertContract: For database insert types
 *
 * Output: packages/contracts/src/generated/contracts.ts
 */

// Control verbose logging
const VERBOSE_LOGGING =
  process.env.DB_VERBOSE !== 'false' &&
  (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true');

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '@revealui/utils/logger';
import { discoverTables, validateTables } from './discover.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Convert camelCase to PascalCase for type names
 */
function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate Contract wrappers file from discovered tables
 */
export function generateContracts(): void {
  // Discover all tables
  const discoveryResult = discoverTables();
  const { tables, errors: discoveryErrors } = discoveryResult;

  // Log discovery errors (warnings)
  if (discoveryErrors.length > 0) {
    for (const error of discoveryErrors) {
      const location = error.position
        ? `${error.file}:${error.position.line}:${error.position.column}`
        : error.file;
      logger.warn(`⚠️  ${location}: ${error.message}${error.context ? ` (${error.context})` : ''}`);
    }
  }

  // Validate tables
  const validation = validateTables(tables);
  if (!validation.valid) {
    throw new Error(
      `Table validation failed:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  // Generate file header
  const header = `/**
 * Auto-generated Contract wrappers
 *
 * DO NOT EDIT - Regenerate with: pnpm generate:all
 *
 * This file provides Contract wrappers for all database tables.
 * Contracts combine TypeScript types, Zod schemas, and runtime validation
 * into a single unified interface.
 *
 * These base contracts can be extended in entity contracts to add
 * business logic, computed fields, and custom validation rules.
 */

import { createContract } from '../foundation/contract.js'
import * as Schemas from './zod-schemas.js'

`;

  // Generate contracts for each table
  const contracts = tables
    .map((table) => {
      const pascalName = toPascalCase(table.variableName);
      return `// =============================================================================
// ${pascalName} Contracts
// =============================================================================

/**
 * Contract for ${table.variableName} row (Select)
 * Database table: ${table.tableName}
 */
export const ${pascalName}RowContract = createContract({
  name: '${pascalName}Row',
  version: '1',
  description: 'Database row contract for ${table.tableName} table',
  schema: Schemas.${pascalName}SelectSchema,
})

/**
 * Contract for ${table.variableName} insert
 * Database table: ${table.tableName}
 */
export const ${pascalName}InsertContract = createContract({
  name: '${pascalName}Insert',
  version: '1',
  description: 'Database insert contract for ${table.tableName} table',
  schema: Schemas.${pascalName}InsertSchema,
})
`;
    })
    .join('\n');

  // Combine header and contracts
  const content = header + contracts;

  // Write to contracts package
  const outputPath = join(__dirname, '../../../contracts/src/generated/contracts.ts');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, 'utf-8');

  if (VERBOSE_LOGGING) {
    logger.info(`✅ Generated Contract wrappers: ${outputPath}`);
    logger.info(`   - ${tables.length} tables processed`);
    logger.info(`   - ${tables.length * 2} contracts generated (Row + Insert)`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    generateContracts();
    if (VERBOSE_LOGGING) {
      logger.info('✨ Contract generation complete!');
    }
  } catch (error) {
    logger.error('❌ Error generating contracts:', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}
