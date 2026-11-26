#!/usr/bin/env tsx

/**
 * Database Backup Command
 *
 * Creates a backup of the database.
 *
 * @dependencies
 * - scripts/lib/database/backup-manager.ts - Backup creation and management
 * - scripts/lib/database/connection.ts - Database connection utilities
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Logger utilities
 *
 * @requires
 * - Environment: POSTGRES_URL - Database connection string
 */

import { createBackup, listBackups } from '@revealui/scripts/database/backup-manager.js';
import {
  createConnection,
  getRestConnectionString,
} from '@revealui/scripts/database/connection.js';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';

const logger = createLogger({ prefix: 'Backup' });

async function main() {
  const args = process.argv.slice(2);
  const requestedFormat = args
    .find((arg) => arg.startsWith('--format='))
    ?.slice('--format='.length);
  const format = requestedFormat ?? (args.includes('--sql') ? 'sql' : 'json');
  if (format !== 'json' && format !== 'sql') throw new Error('Unsupported backup format');
  const retainCount = Number(
    args.find((arg) => arg.startsWith('--retain='))?.slice('--retain='.length) ?? '5',
  );
  if (!Number.isSafeInteger(retainCount) || retainCount < 1)
    throw new Error('Retention count must be a positive safe integer');

  logger.header('Database Backup');

  const connectionString = getRestConnectionString();
  if (!connectionString) {
    logger.error('No database connection string found');
    logger.info('Set POSTGRES_URL environment variable');
    process.exit(ErrorCode.EXECUTION_ERROR);
  }

  const connection = await createConnection({ connectionString, logger });

  try {
    const result = await createBackup(connection, import.meta.url, {
      format,
      retainCount,
      logger,
    });

    if (result.success) {
      logger.success('Backup completed');
      if (result.path) {
        logger.info(`File: ${result.path}`);
      }
      if (result.metadata) {
        logger.info(`Tables: ${result.metadata.tables.length}`);
        logger.info(
          `Total rows: ${Object.values(result.metadata.rowCounts).reduce((a, b) => a + b, 0)}`,
        );
      }
    } else {
      logger.error(`Backup failed: ${result.error}`);
      process.exitCode = ErrorCode.CONFIG_ERROR;
      return;
    }

    // Show recent backups
    logger.divider();
    logger.info('Recent backups:');
    const backups = await listBackups(import.meta.url);
    for (const backup of backups.slice(0, 5)) {
      logger.info(`  - ${backup}`);
    }
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  logger.error(error.message);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
