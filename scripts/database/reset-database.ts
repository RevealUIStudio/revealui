#!/usr/bin/env tsx

/**
 * Database Reset Script
 * Resets the database by dropping all tables and recreating the schema
 *
 * Usage:
 *   pnpm db:reset
 *   pnpm tsx scripts/database/reset-database.ts
 */

import { confirm, createLogger, getProjectRoot, requireEnv } from '../shared/utils.js'

const logger = createLogger()

async function resetDatabase() {
  try {
    const _projectRoot = await getProjectRoot(import.meta.url)
    logger.header('Database Reset')

    // Get database connection info
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    if (!connectionString) {
      logger.error('No database connection string found!')
      logger.error('Set one of: DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI')
      process.exit(1)
    }

    logger.warning('⚠️  This will DROP ALL TABLES and DATA in the database!')
    logger.warning('This action cannot be undone.')

    const confirmed = await confirm('Are you sure you want to reset the database?')
    if (!confirmed) {
      logger.info('Database reset cancelled.')
      return
    }

    logger.info('Resetting database...')

    // For now, just show that the script runs
    // In a real implementation, this would connect to the database and drop tables
    logger.info('Database reset functionality would go here...')
    logger.success('Database reset script executed (placeholder)')
  } catch (error) {
    logger.error(`Database reset failed: ${error}`)
    process.exit(1)
  }
}

resetDatabase()
