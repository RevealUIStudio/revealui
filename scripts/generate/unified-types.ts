#!/usr/bin/env tsx
/**
 * Unified Type Generation Orchestrator
 *
 * Master script that orchestrates all type generation steps:
 * 1. Generate TypeScript types from Drizzle schemas
 * 2. Generate Zod schemas from Drizzle schemas
 * 3. Generate Contract wrappers from Zod schemas
 * 4. Validate type consistency
 *
 * This ensures a single command regenerates the entire type system
 * from the source of truth (Drizzle schemas).
 *
 * Usage: pnpm generate:all
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ErrorCode } from '../lib/errors.js'

const VERBOSE_LOGGING =
  process.env.DB_VERBOSE !== 'false' &&
  (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true')

/**
 * Execute a command and return its output
 */
function exec(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      stdio: VERBOSE_LOGGING ? 'inherit' : 'pipe',
    })
  } catch (error) {
    console.error(`❌ Command failed: ${command}`)
    throw error
  }
}

/**
 * Main generation orchestrator
 */
async function generateUnifiedTypes(): Promise<void> {
  console.log('🔄 Generating unified type system...\n')

  const rootDir = join(import.meta.dirname, '../..')
  const dbPackage = join(rootDir, 'packages/db')

  // Verify db package exists
  if (!existsSync(dbPackage)) {
    throw new Error(`Database package not found at: ${dbPackage}`)
  }

  // Step 1: Generate TypeScript types from Drizzle
  console.log('📦 Step 1/4: Generating Drizzle TypeScript types...')
  exec('pnpm generate:types', dbPackage)
  console.log('✅ Drizzle types generated\n')

  // Step 2: Generate Zod schemas from Drizzle
  console.log('🔍 Step 2/4: Generating Zod schemas from Drizzle...')
  exec('pnpm generate:zod', dbPackage)
  console.log('✅ Zod schemas generated\n')

  // Step 3: Generate Contract wrappers
  console.log('📋 Step 3/4: Generating Contract wrappers...')
  exec('pnpm generate:contracts', dbPackage)
  console.log('✅ Contract wrappers generated\n')

  // Step 4: Validate type consistency
  console.log('✅ Step 4/4: Validating type consistency...')
  // Import and run validation (to be implemented in next task)
  try {
    const { validateSync } = await import('./validate-sync.js')
    const validation = await validateSync()

    if (!validation.success) {
      console.error('❌ Type drift detected:')
      for (const error of validation.errors) {
        console.error(`  - ${error}`)
      }
      process.exit(ErrorCode.VALIDATION_ERROR)
    }
    console.log('✅ Type consistency validated\n')
  } catch (error) {
    // Validation script not yet implemented, skip for now
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      console.log('⚠️  Validation script not yet implemented, skipping...\n')
    } else {
      throw error
    }
  }

  console.log('✨ Type generation complete!')
  console.log('\nGenerated files:')
  console.log('  - packages/db/src/types/database.ts')
  console.log('  - packages/contracts/src/generated/zod-schemas.ts')
  console.log('  - packages/contracts/src/generated/contracts.ts')
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await generateUnifiedTypes()
  } catch (error) {
    console.error('❌ Error generating unified types:', error)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

export { generateUnifiedTypes }
