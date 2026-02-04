#!/usr/bin/env tsx

/**
 * Post-Migration Type Generator
 *
 * Automatically regenerates TypeScript types after database migrations.
 * Run this after applying Drizzle migrations to keep types in sync.
 *
 * @dependencies
 * - node:child_process - Command execution
 * - scripts/lib/errors.ts - Error handling
 * - scripts/lib/index.ts - Logger utilities
 *
 * @example
 * ```bash
 * # After running migrations
 * pnpm db:migrate && pnpm db:generate-types
 * ```
 */

import { execSync } from 'node:child_process'
import { ErrorCode } from '../lib/errors.js'
import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'PostMigration' })

async function generateTypesAfterMigration() {
  try {
    logger.header('Post-Migration Type Generation')
    logger.info('Regenerating types from updated schema...')
    console.log()

    const startTime = Date.now()

    // Generate database types
    logger.info('📦 Generating @revealui/db types...')
    execSync('pnpm --filter @revealui/db generate:types', {
      stdio: 'inherit',
      encoding: 'utf-8',
    })

    // Generate contracts
    logger.info('📋 Generating @revealui/contracts types...')
    execSync('pnpm --filter @revealui/contracts generate:types', {
      stdio: 'inherit',
      encoding: 'utf-8',
    })

    // Generate Zod schemas
    logger.info('🔍 Generating Zod validation schemas...')
    execSync('pnpm --filter @revealui/db generate:zod', {
      stdio: 'inherit',
      encoding: 'utf-8',
    })

    const duration = Date.now() - startTime

    console.log()
    logger.success(`✅ All types generated successfully in ${duration}ms`)
    logger.info('💡 Types are now in sync with your database schema')
  } catch (error) {
    logger.error(
      `❌ Type generation failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    logger.info('💡 Try running: pnpm generate:all')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

async function main() {
  try {
    await generateTypesAfterMigration()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
