#!/usr/bin/env tsx

/**
 * Run Database Migration
 * Cross-platform replacement for run-migration.sh
 */

import { join } from 'node:path'
import { ErrorCode } from '../lib/errors.js'
import {
  commandExists,
  confirm,
  createLogger,
  execCommand,
  getProjectRoot,
  requireEnv,
} from '../lib/index.js'

const logger = createLogger()

async function main() {
  logger.header('CRDT Fixes Migration Script')

  // Check if database URL is set
  const dbUrl = requireEnv('POSTGRES_URL', 'DATABASE_URL')
  logger.info(`Database URL: ${dbUrl.substring(0, 20)}...`)

  const projectRoot = await getProjectRoot(import.meta.url)
  const dbPackagePath = join(projectRoot, 'packages/db')

  // Step 1: Generate migration
  logger.header('Step 1: Generating migration (if needed)')
  const generateResult = await execCommand('pnpm', ['db:generate'], {
    cwd: dbPackagePath,
    silent: true,
  })

  if (generateResult.success) {
    logger.success('Migration generated')
  } else {
    logger.info('No new migrations needed')
  }

  // Step 2: Push schema
  logger.header('Step 2: Pushing schema to database')
  logger.warning('WARNING: This will modify your database!')

  const shouldContinue = await confirm('Continue?', false)
  if (!shouldContinue) {
    logger.info('Aborted.')
    process.exit(0)
  }

  const pushResult = await execCommand('pnpm', ['db:push'], {
    cwd: dbPackagePath,
  })

  if (!pushResult.success) {
    logger.error('Failed to push schema to database')
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  // Step 3: Verify migration
  logger.header('Step 3: Verifying migration')

  const hasPsql = await commandExists('psql')
  if (hasPsql) {
    logger.info('Verifying node_id_mappings table...')
    const tableCheck = await execCommand(
      'psql',
      [dbUrl, '-c', 'SELECT COUNT(*) FROM node_id_mappings;'],
      { silent: true },
    )

    if (tableCheck.success) {
      logger.success('node_id_mappings table exists')
    } else {
      logger.warning('Table check failed')
    }

    logger.info('Verifying embedding_metadata column...')
    const columnCheck = await execCommand(
      'psql',
      [
        dbUrl,
        '-c',
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'embedding_metadata';",
      ],
      { silent: true },
    )

    if (columnCheck.success) {
      logger.success('embedding_metadata column exists')
    } else {
      logger.warning('Column check failed')
    }

    logger.success('Migration verification complete!')
  } else {
    logger.warning('psql not available. Please verify manually:')
    logger.info('  1. Check node_id_mappings table exists')
    logger.info('  2. Check embedding_metadata column exists in agent_memories')
    logger.info('')
    logger.info('SQL to run:')
    logger.info('  SELECT COUNT(*) FROM node_id_mappings;')
    logger.info(
      "  SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agent_memories' AND column_name = 'embedding_metadata';",
    )
  }

  logger.header('Migration complete!')
}

main().catch((error) => {
  logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof Error && error.stack) {
    logger.error(`Stack trace: ${error.stack}`)
  }
  process.exit(ErrorCode.EXECUTION_ERROR)
})
