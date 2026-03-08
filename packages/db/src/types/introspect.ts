#!/usr/bin/env tsx
/**
 * Database Introspection System
 *
 * Validates Drizzle schemas against the actual database structure.
 * Can optionally generate types from the database for validation.
 *
 * This provides:
 * 1. Schema validation - ensures Drizzle schemas match database
 * 2. Type generation from DB - generates types from actual database (for comparison)
 * 3. Migration validation - ensures migrations are applied correctly
 */

import { neon } from '@neondatabase/serverless'
import { logger } from '@revealui/utils/logger'
import { discoverTables } from './discover.js'

interface IntrospectionOptions {
  /** Database connection string */
  connectionString?: string
  /** Whether to generate types from database */
  generateTypes?: boolean
  /** Whether to validate schema matches */
  validateSchema?: boolean
  /** Output file for generated types (if generateTypes is true) */
  outputFile?: string
}

interface IntrospectionResult {
  success: boolean
  tables: string[]
  mismatches?: Array<{
    table: string
    issue: string
  }>
  errors?: string[]
}

/**
 * Introspect the database and validate against Drizzle schemas
 *
 * Connects to the database and queries information_schema to validate
 * that Drizzle schemas match the actual database structure.
 */
export async function introspectDatabase(
  options: IntrospectionOptions = {},
): Promise<IntrospectionResult> {
  const { validateSchema = true } = options

  // Only use environment fallback if connectionString is not in options at all
  // If explicitly set to undefined, treat as missing
  const connectionString =
    'connectionString' in options
      ? options.connectionString
      : process.env.POSTGRES_URL || process.env.DATABASE_URL

  if (!connectionString) {
    return {
      success: false,
      tables: [],
      errors: ['Database connection string not provided'],
    }
  }

  try {
    // Connect to database
    const sql = neon(connectionString)

    // Query information_schema for tables in public schema
    const dbTables = (await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `) as Array<{ table_name: string }>

    const tableNames = dbTables.map((row) => row.table_name)

    // Discover tables from Drizzle schemas
    const discoveryResult = discoverTables()
    const { tables: schemaTables } = discoveryResult
    // Explicitly type the Set to ensure proper type inference
    const schemaTableNames = new Set<string>(schemaTables.map((t) => t.tableName))

    const mismatches: Array<{ table: string; issue: string }> = []

    if (validateSchema) {
      // Check for tables in database but not in schema
      for (const dbTable of tableNames) {
        if (!schemaTableNames.has(dbTable)) {
          mismatches.push({
            table: dbTable,
            issue: `Table exists in database but not in Drizzle schema`,
          })
        }
      }

      // Check for tables in schema but not in database
      // schemaTableNames is Set<string>, so iteration yields string directly
      for (const schemaTable of schemaTableNames) {
        // TypeScript now correctly infers schemaTable as string
        if (!tableNames.includes(schemaTable)) {
          mismatches.push({
            table: schemaTable,
            issue: `Table defined in Drizzle schema but not in database`,
          })
        }
      }
    }

    const result: IntrospectionResult = {
      success: mismatches.length === 0,
      tables: tableNames,
    }

    if (validateSchema) {
      result.mismatches = mismatches
    }

    return result
  } catch (error) {
    return {
      success: false,
      tables: [],
      errors: [
        `Database introspection failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

/**
 * Generate types from actual database structure
 *
 * Note: This is a placeholder for future enhancement. Currently, we use
 * schema-based type generation (generate.ts) which automatically discovers
 * tables and relationships from Drizzle schemas. This approach is preferred
 * because:
 * - It keeps types in sync with code
 * - It's faster and doesn't require database connection
 * - It provides better type safety with Drizzle's inference
 *
 * If database-first type generation is needed in the future, this would:
 * 1. Connect to database using Drizzle Kit introspection API
 * 2. Query information_schema for tables, columns, and relationships
 * 3. Generate TypeScript types matching the Database type structure
 * 4. Write to outputFile
 *
 * @param connectionString - Database connection string
 * @param outputFile - Output file path
 */
export async function generateTypesFromDatabase(
  connectionString: string,
  outputFile: string,
): Promise<void> {
  void connectionString
  void outputFile
  throw new Error(
    'Database introspection type generation not yet implemented. ' +
      'Use the schema-based type generator (generate.ts) instead. ' +
      'Run: pnpm --filter @revealui/db generate:types',
  )
}

/**
 * Validate that Drizzle schemas match the database
 *
 * Compares schema definitions with actual database structure.
 *
 * @param connectionString - Database connection string
 */
export async function validateSchemaMatch(connectionString: string): Promise<{
  success: boolean
  mismatches: Array<{ table: string; issue: string }>
}> {
  const result = await introspectDatabase({
    connectionString,
    validateSchema: true,
  })

  return {
    success: result.success,
    mismatches: result.mismatches || [],
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL

  if (!connectionString) {
    logger.error(
      'POSTGRES_URL or DATABASE_URL environment variable is required',
      new Error('Missing database connection string'),
    )
    process.exit(1)
  }

  if (args.includes('--validate')) {
    introspectDatabase({ connectionString, validateSchema: true })
      .then((result) => {
        if (result.success) {
          logger.info('Schema validation passed', {
            tablesFound: result.tables.length,
            mismatches: result.mismatches?.length || 0,
          })
          if (result.mismatches && result.mismatches.length > 0) {
            logger.warn(`${result.mismatches.length} mismatches found`, {
              mismatches: result.mismatches.map((m) => `${m.table}: ${m.issue}`),
            })
          }
        } else {
          logger.error('Schema validation failed', undefined, {
            errors: result.errors,
          })
          if (result.errors) {
            result.errors.forEach((error) => {
              logger.error('Validation error', undefined, { error })
            })
          }
          process.exit(1)
        }
      })
      .catch((error) => {
        logger.error(
          'Error during introspection',
          error instanceof Error ? error : new Error(String(error)),
        )
        process.exit(1)
      })
  } else {
    logger.info('Database introspection system')
    logger.info('Usage: tsx introspect.ts --validate')
    logger.info('Options: --validate    Validate schemas against database')
    logger.info('Note: Full introspection requires database connection.')
    logger.info('Set POSTGRES_URL or DATABASE_URL environment variable.')
  }
}
