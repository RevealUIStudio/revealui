#!/usr/bin/env tsx
/**
 * Database Restore Command
 *
 * Restores the database from a backup.
 */

import { join } from 'node:path'
import { confirm, createLogger, getProjectRoot } from '../../lib/index.js'
import { createConnection, getRestConnectionString } from '../../engineer/setup/db/connection.js'
import { listBackups, restoreBackup } from '../../engineer/setup/db/backup-manager.js'

const logger = createLogger({ prefix: 'Restore' })

async function main() {
  const args = process.argv.slice(2)
  const backupFile = args.find((a) => !a.startsWith('--'))
  const skipConfirmation = args.includes('--confirm') || args.includes('-y')
  const clearTables = !args.includes('--no-clear')

  logger.header('Database Restore')

  const projectRoot = await getProjectRoot(import.meta.url)
  const backupDir = join(projectRoot, '.revealui', 'backups')

  // Get backup file
  let backupPath: string

  if (backupFile) {
    // Use specified backup
    backupPath = backupFile.includes('/') ? backupFile : join(backupDir, backupFile)
  } else {
    // Show available backups
    const backups = await listBackups(import.meta.url)

    if (backups.length === 0) {
      logger.error('No backups found')
      process.exit(1)
    }

    logger.info('Available backups:')
    for (let i = 0; i < backups.length; i++) {
      logger.info(`  ${i + 1}. ${backups[i]}`)
    }

    logger.error('Specify a backup file to restore')
    logger.info('Usage: pnpm db:restore <backup-file>')
    process.exit(1)
  }

  // Confirm restore
  if (!skipConfirmation) {
    logger.warn('This will overwrite existing data in the database!')
    const confirmed = await confirm('Are you sure you want to restore?')
    if (!confirmed) {
      logger.info('Restore cancelled')
      return
    }
  }

  // Connect to database
  const connectionString = getRestConnectionString()
  if (!connectionString) {
    logger.error('No database connection string found')
    process.exit(1)
  }

  const connection = await createConnection({ connectionString, logger })

  try {
    logger.info(`Restoring from: ${backupPath}`)

    const result = await restoreBackup(connection, backupPath, {
      logger,
      clearTables,
    })

    if (result.success) {
      logger.success('Restore completed')
    } else {
      logger.error(`Restore failed: ${result.error}`)
      process.exit(1)
    }
  } finally {
    await connection.close()
  }
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
