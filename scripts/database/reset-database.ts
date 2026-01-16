#!/usr/bin/env tsx

/**
 * Database Reset Script
 *
 * Resets the database by dropping all tables and data.
 * WARNING: This will drop all tables and data!
 *
 * Usage:
 *   pnpm tsx scripts/database/reset-database.ts
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger, requireEnv, confirm, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

async function resetDatabase() {
  try {
    logger.header('Database Reset')
    logger.warning('⚠️  WARNING: This will drop all tables and data!')

    // Get connection string from environment
    const connectionString =
      process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DATABASE_URI

    if (!connectionString) {
      logger.error('No database connection string found!')
      logger.error('Set one of: DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI')
      process.exit(1)
    }

    // Show connection info (without password)
    const connectionInfo = connectionString.split('@')[1]?.split('/')[0] || 'unknown'
    logger.info(`Database: ${connectionInfo}`)

    // Confirm action
    const confirmed = await confirm(
      'Are you sure you want to drop all tables and data?',
      false,
    )

    if (!confirmed) {
      logger.info('Aborted.')
      process.exit(0)
    }

    // Read SQL file
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const projectRoot = await getProjectRoot(import.meta.url)
    const sqlPath = join(__dirname, 'reset-database.sql')

    logger.info('\nDropping all tables...')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Use pg library for direct SQL execution
    const { Pool } = await import('pg')
    const pool = new Pool({
      connectionString,
      ssl:
        connectionString.includes('sslmode=require') || connectionString.includes('ssl=true')
          ? { rejectUnauthorized: false }
          : undefined,
    })

    const client = await pool.connect()
    try {
      // Execute SQL
      await client.query(sql)
      logger.success('✅ Database reset complete!')
      logger.info(
        '\nNote: Tables will be recreated when you run the initial migration (0000_misty_pepper_potts.sql)',
      )
    } finally {
      client.release()
      await pool.end()
    }
  } catch (error) {
    logger.error(`Database reset failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }

    if (error instanceof Error) {
      if (error.message.includes('connection')) {
        logger.info('\n💡 Tips:')
        logger.info('   - Check your DATABASE_URL environment variable')
        logger.info('   - Verify database credentials are correct')
        logger.info('   - Ensure database is accessible (check IP allowlist)')
      }
    }

    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await resetDatabase()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
