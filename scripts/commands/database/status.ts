#!/usr/bin/env tsx

/**
 * Database Status Command
 *
 * Shows the current database status including connection info,
 * table counts, and schema version.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Logger, database validation, and table utilities
 * - pg - PostgreSQL client for database queries
 *
 * @requires
 * - Environment: POSTGRES_URL or DATABASE_URL — Neon (pgvector lives on the same DB)
 */

import { getSSLConfig } from '@revealui/scripts/database/ssl-config.js';
import { ErrorCode } from '@revealui/scripts/errors.js';
import {
  createLogger,
  detectDatabaseProvider,
  listTables,
  validateDatabaseConnection,
} from '@revealui/scripts/index.js';

const logger = createLogger({ prefix: 'DB Status' });

async function main() {
  logger.header('Database Status');

  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (url) {
    await showDatabaseStatus('Neon', url);
  } else {
    logger.warn('Database: Not configured (POSTGRES_URL not set)');
  }
}

async function showDatabaseStatus(name: string, connectionString: string) {
  const provider = detectDatabaseProvider(connectionString);

  logger.info(`${name} Database (${provider})`);
  logger.divider();

  // Test connection
  const connectionResult = await validateDatabaseConnection(connectionString, { logger });

  if (!connectionResult.connected) {
    logger.error(`Connection failed: ${connectionResult.error}`);
    return;
  }

  logger.success(`Connected (${connectionResult.latencyMs}ms)`);
  logger.info(`Server version: ${connectionResult.serverVersion}`);
  logger.info(`Database: ${connectionResult.database}`);

  // Get table info
  try {
    const tables = await listTables(connectionString);
    logger.info(`Tables: ${tables.length}`);

    if (tables.length > 0) {
      logger.divider();
      logger.info('Tables:');

      // Get row counts for each table
      const { Pool } = await import('pg');
      const pool = new Pool({
        connectionString,
        ssl: getSSLConfig(connectionString),
      });

      try {
        const client = await pool.connect();
        try {
          for (const table of tables.slice(0, 20)) {
            try {
              const result = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
              const count = result.rows[0]?.count || 0;
              logger.info(`  - ${table}: ${count} rows`);
            } catch {
              logger.info(`  - ${table}: (error reading)`);
            }
          }

          if (tables.length > 20) {
            logger.info(`  ... and ${tables.length - 20} more tables`);
          }
        } finally {
          client.release();
        }
      } finally {
        await pool.end();
      }
    }
  } catch (error) {
    logger.error(`Could not list tables: ${error}`);
  }
}

main().catch((error) => {
  logger.error(error.message);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
