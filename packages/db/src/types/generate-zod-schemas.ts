#!/usr/bin/env tsx
/**
 * Zod Schema Generator
 *
 * Generates Zod schemas from Drizzle table definitions using drizzle-zod.
 * This ensures Drizzle schemas are the single source of truth.
 *
 * Generated schemas include:
 * - SelectSchema: For reading rows from the database
 * - InsertSchema: For inserting new rows
 * - Row type: TypeScript type for Select
 * - Insert type: TypeScript type for Insert
 *
 * Output: packages/contracts/src/generated/zod-schemas.ts
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
 * Generate Zod schemas file from Drizzle tables
 */
export function generateZodSchemas(): void {
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
 * Auto-generated Zod schemas from Drizzle
 *
 * DO NOT EDIT - Regenerate with: pnpm generate:all
 *
 * This file provides Zod schemas for all database tables, generated
 * directly from Drizzle table definitions using drizzle-zod.
 * These schemas are used for runtime validation and form the base
 * for entity contracts in @revealui/contracts/entities.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import type { z } from 'zod'
import * as tables from '@revealui/db/schema'

`;

  // Generate schemas for each table
  const schemas = tables
    .map((table) => {
      const pascalName = toPascalCase(table.variableName);
      return `// =============================================================================
// ${pascalName} Schemas
// =============================================================================

/**
 * Zod schema for selecting ${table.variableName} rows from database
 * Generated from Drizzle table definition: tables.${table.variableName}
 */
export const ${pascalName}SelectSchema = createSelectSchema(tables.${table.variableName})

/**
 * Zod schema for inserting ${table.variableName} rows to database
 * Generated from Drizzle table definition: tables.${table.variableName}
 */
export const ${pascalName}InsertSchema = createInsertSchema(tables.${table.variableName})

/**
 * TypeScript type for ${table.variableName} row (Select)
 */
export type ${pascalName}Row = z.infer<typeof ${pascalName}SelectSchema>

/**
 * TypeScript type for ${table.variableName} insert
 */
export type ${pascalName}Insert = z.infer<typeof ${pascalName}InsertSchema>
`;
    })
    .join('\n');

  // Combine header and schemas
  const content = header + schemas;

  // Write to contracts package (where it will be consumed)
  const outputPath = join(__dirname, '../../../contracts/src/generated/zod-schemas.ts');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, 'utf-8');

  if (VERBOSE_LOGGING) {
    logger.info(`✅ Generated Zod schemas: ${outputPath}`);
    logger.info(`   - ${tables.length} tables processed`);
    logger.info(`   - ${tables.length * 2} schemas generated (Select + Insert)`);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    generateZodSchemas();
    if (VERBOSE_LOGGING) {
      logger.info('✨ Zod schema generation complete!');
    }
  } catch (error) {
    logger.error('❌ Error generating Zod schemas:', error instanceof Error ? error : undefined);
    process.exit(1);
  }
}
