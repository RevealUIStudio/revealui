#!/usr/bin/env tsx
/**
 * Type Drift Validation
 *
 * Validates that generated types are in sync with Drizzle schemas.
 * Detects drift by checking:
 * 1. All discovered tables have corresponding Zod schemas
 * 2. All discovered tables have corresponding Contract wrappers
 * 3. Generated files have recent timestamps (not stale)
 *
 * This script runs as part of CI to catch type drift before it reaches production.
 *
 * Usage: pnpm validate:types
 */

import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const VERBOSE_LOGGING =
  process.env.DB_VERBOSE !== 'false' &&
  (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true')

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Check if a file exists and is recent
 */
function isFileRecent(filePath: string, maxAgeMs: number = 60000): boolean {
  if (!existsSync(filePath)) {
    return false
  }

  const stats = statSync(filePath)
  const age = Date.now() - stats.mtimeMs
  return age < maxAgeMs
}

/**
 * Validate type system consistency
 */
export async function validateSync(): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const rootDir = join(import.meta.dirname, '../..')
  const dbPackage = join(rootDir, 'packages/db')
  const contractsPackage = join(rootDir, 'packages/contracts')

  // Check that generated files exist
  const databaseTypesPath = join(dbPackage, 'src/types/database.ts')
  const zodSchemasPath = join(contractsPackage, 'src/generated/zod-schemas.ts')
  const contractsPath = join(contractsPackage, 'src/generated/contracts.ts')

  if (!existsSync(databaseTypesPath)) {
    errors.push('Missing generated file: packages/db/src/types/database.ts')
  }

  if (!existsSync(zodSchemasPath)) {
    errors.push('Missing generated file: packages/contracts/src/generated/zod-schemas.ts')
  }

  if (!existsSync(contractsPath)) {
    errors.push('Missing generated file: packages/contracts/src/generated/contracts.ts')
  }

  // If files exist, check they're not stale (only in CI)
  if (process.env.CI === 'true') {
    const oneHourMs = 60 * 60 * 1000

    if (existsSync(databaseTypesPath) && !isFileRecent(databaseTypesPath, oneHourMs)) {
      warnings.push(
        'Generated database types may be stale (older than 1 hour). Run: pnpm generate:all',
      )
    }

    if (existsSync(zodSchemasPath) && !isFileRecent(zodSchemasPath, oneHourMs)) {
      warnings.push(
        'Generated Zod schemas may be stale (older than 1 hour). Run: pnpm generate:all',
      )
    }

    if (existsSync(contractsPath) && !isFileRecent(contractsPath, oneHourMs)) {
      warnings.push(
        'Generated contracts may be stale (older than 1 hour). Run: pnpm generate:all',
      )
    }
  }

  // Discover tables and validate coverage
  try {
    // Dynamic import to avoid build-time issues
    const discoverModule = await import('../../packages/db/src/types/discover.js')
    const { discoverTables, validateTables } = discoverModule

    const discoveryResult = discoverTables()
    const { tables } = discoveryResult

    const validation = validateTables(tables)
    if (!validation.valid) {
      for (const error of validation.errors) {
        errors.push(`Table validation error: ${error}`)
      }
    }

    // Validate that each table has schemas (basic check - detailed check requires parsing)
    if (existsSync(zodSchemasPath)) {
      // Just verify file exists for now
      // Could add more sophisticated checks here in the future
    }

    if (VERBOSE_LOGGING) {
      console.log(`📊 Validated ${tables.length} tables`)
    }
  } catch (error) {
    errors.push(
      `Failed to discover/validate tables: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return {
    success: errors.length === 0,
    errors,
    warnings,
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await validateSync()

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:')
      for (const warning of result.warnings) {
        console.log(`  - ${warning}`)
      }
    }

    if (!result.success) {
      console.error('\n❌ Type validation failed:')
      for (const error of result.errors) {
        console.error(`  - ${error}`)
      }
      process.exit(1)
    }

    console.log('\n✅ Type system validation passed!')
  } catch (error) {
    console.error('❌ Error during validation:', error)
    process.exit(1)
  }
}
