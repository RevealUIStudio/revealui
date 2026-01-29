#!/usr/bin/env tsx
/**
 * Database Backup Command
 *
 * Creates a backup of the database.
 */

import { createLogger } from '../../lib/index.js'
import { createConnection, getRestConnectionString } from '../../lib/database/connection.js'
import { createBackup, listBackups } from '../../lib/database/backup-manager.js'

const logger = createLogger({ prefix: 'Backup' })

async function main() {
  const args = process.argv.slice(2)
  const format = args.includes('--sql') ? 'sql' : 'json'
  const retainCount = parseInt(args.find((a) => a.startsWith('--retain='))?.split('=')[1] || '5', 10)

  logger.header('Database Backup')

  const connectionString = getRestConnectionString()
  if (!connectionString) {
    logger.error('No database connection string found')
    logger.info('Set POSTGRES_URL environment variable')
    process.exit(1)
  }

  const connection = await createConnection({ connectionString, logger })

  try {
    const result = await createBackup(connection, import.meta.url, {
      format: format as 'json' | 'sql',
      retainCount,
      logger,
    })

    if (result.success) {
      logger.success('Backup completed')
      if (result.path) {
        logger.info(`File: ${result.path}`)
      }
      if (result.metadata) {
        logger.info(`Tables: ${result.metadata.tables.length}`)
        logger.info(`Total rows: ${Object.values(result.metadata.rowCounts).reduce((a, b) => a + b, 0)}`)
      }
    } else {
      logger.error(`Backup failed: ${result.error}`)
      process.exit(1)
    }

    // Show recent backups
    logger.divider()
    logger.info('Recent backups:')
    const backups = await listBackups(import.meta.url)
    for (const backup of backups.slice(0, 5)) {
      logger.info(`  - ${backup}`)
    }
  } finally {
    await connection.close()
  }
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
