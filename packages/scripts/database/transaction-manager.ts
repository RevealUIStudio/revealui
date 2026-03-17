/**
 * Transaction Manager
 *
 * Provides transaction wrappers with automatic rollback on failure.
 *
 * @dependencies
 * - scripts/lib/index.ts - Logger utilities
 * - scripts/lib/database/connection.ts - Database connection interface
 * - pg - PostgreSQL client for transaction management
 */

import type { PoolClient } from 'pg';
import { createLogger, type Logger } from '../index.js';
import type { DatabaseConnection } from './connection.js';

export interface TransactionOptions {
  /** Transaction timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Logger instance */
  logger?: Logger;
  /** Whether to use savepoints for nested transactions */
  useSavepoints?: boolean;
}

export interface TransactionContext {
  client: PoolClient;
  savepointId: number;
  createSavepoint(name: string): Promise<void>;
  rollbackToSavepoint(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
}

const defaultLogger = createLogger({ level: 'silent' });

/**
 * Executes a function within a database transaction.
 *
 * @example
 * ```typescript
 * const result = await withTransaction(connection, async (ctx) => {
 *   await ctx.client.query('INSERT INTO users (name) VALUES ($1)', ['John'])
 *   await ctx.client.query('INSERT INTO logs (action) VALUES ($1)', ['user_created'])
 *   return { success: true }
 * })
 * ```
 */
export async function withTransaction<T>(
  connection: DatabaseConnection,
  fn: (ctx: TransactionContext) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const {
    timeout = 300000,
    logger = defaultLogger,
    useSavepoints: _useSavepoints = false,
  } = options;

  const client = await connection.connect();
  const _savepointId = 0;

  const ctx: TransactionContext = {
    client,
    savepointId: 0,

    async createSavepoint(name: string): Promise<void> {
      await client.query(`SAVEPOINT ${name}`);
    },

    async rollbackToSavepoint(name: string): Promise<void> {
      await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    },

    async releaseSavepoint(name: string): Promise<void> {
      await client.query(`RELEASE SAVEPOINT ${name}`);
    },
  };

  // Set up timeout
  const timeoutId = setTimeout(async () => {
    logger.error(`Transaction timed out after ${timeout}ms`);
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors during timeout
    }
    client.release();
  }, timeout);

  try {
    await client.query('BEGIN');
    logger.debug('Transaction started');

    const result = await fn(ctx);

    await client.query('COMMIT');
    logger.debug('Transaction committed');

    return result;
  } catch (error) {
    logger.error(`Transaction failed: ${error}`);
    try {
      await client.query('ROLLBACK');
      logger.debug('Transaction rolled back');
    } catch (rollbackError) {
      logger.error(`Rollback failed: ${rollbackError}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    client.release();
  }
}

/**
 * Executes multiple operations in a single transaction.
 *
 * @example
 * ```typescript
 * await batchTransaction(connection, [
 *   { sql: 'DELETE FROM logs WHERE created_at < $1', params: [cutoffDate] },
 *   { sql: 'DELETE FROM sessions WHERE expires_at < $1', params: [now] },
 * ])
 * ```
 */
export async function batchTransaction(
  connection: DatabaseConnection,
  operations: Array<{ sql: string; params?: unknown[] }>,
  options: TransactionOptions = {},
): Promise<{ success: boolean; results: Array<{ rowCount: number }> }> {
  const { logger = defaultLogger } = options;

  return withTransaction(
    connection,
    async (ctx) => {
      const results: Array<{ rowCount: number }> = [];

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        logger.debug(`Executing operation ${i + 1}/${operations.length}`);

        const result = await ctx.client.query(op.sql, op.params);
        results.push({ rowCount: result.rowCount ?? 0 });
      }

      return { success: true, results };
    },
    options,
  );
}

/**
 * Executes a migration with automatic rollback on failure.
 */
export async function runMigrationTransaction(
  connection: DatabaseConnection,
  migrationSql: string,
  options: TransactionOptions & { migrationName?: string } = {},
): Promise<boolean> {
  const { migrationName = 'unnamed', logger = defaultLogger, ...txOptions } = options;

  logger.info(`Running migration: ${migrationName}`);

  try {
    await withTransaction(
      connection,
      async (ctx) => {
        // Split migration by statement breakpoints
        const statements = migrationSql
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        logger.info(`Migration has ${statements.length} statements`);

        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          logger.debug(`Executing statement ${i + 1}/${statements.length}`);
          await ctx.client.query(stmt);
        }
      },
      { ...txOptions, logger },
    );

    logger.success(`Migration completed: ${migrationName}`);
    return true;
  } catch (error) {
    logger.error(`Migration failed: ${migrationName}`);
    logger.error(`Error: ${error}`);
    return false;
  }
}
