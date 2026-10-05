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

import { escapeIdentifier, type PoolClient } from 'pg';
import { createLogger, type Logger } from '../index.js';
import type { DatabaseConnection } from './connection.js';

export interface TransactionOptions {
  /** Transaction timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Logger instance */
  logger?: Logger;
  /** Whether to use savepoints for nested transactions */
  useSavepoints?: boolean;
  /** PostgreSQL isolation level for the managed transaction. */
  isolationLevel?: 'read committed' | 'repeatable read' | 'serializable';
  /** Prevent writes during snapshot reads. */
  readOnly?: boolean;
  /** Cancellation is checked before commit, after in-flight work settles. */
  signal?: AbortSignal;
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
    isolationLevel = 'read committed',
    readOnly = false,
    signal,
  } = options;
  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new Error('Transaction timeout must be a positive safe integer');
  }
  if (!['read committed', 'repeatable read', 'serializable'].includes(isolationLevel)) {
    throw new Error('Unsupported transaction isolation level');
  }
  signal?.throwIfAborted();
  const client = await connection.connect();
  let discard = false;
  let began = false;
  let committing = false;
  let commitAcknowledged = false;
  let expired = false;
  const deadline = Date.now() + timeout;

  const ctx: TransactionContext = {
    client,
    savepointId: 0,

    async createSavepoint(name: string): Promise<void> {
      await client.query(`SAVEPOINT ${escapeIdentifier(name)}`);
    },

    async rollbackToSavepoint(name: string): Promise<void> {
      await client.query(`ROLLBACK TO SAVEPOINT ${escapeIdentifier(name)}`);
    },

    async releaseSavepoint(name: string): Promise<void> {
      await client.query(`RELEASE SAVEPOINT ${escapeIdentifier(name)}`);
    },
  };

  // The callback owns in-flight work until it settles. A timer must never roll
  // back or return its client to the pool while that work can still issue queries.
  const timeoutId = setTimeout(() => {
    expired = true;
  }, timeout);

  try {
    await client.query(
      `BEGIN ISOLATION LEVEL ${isolationLevel.toUpperCase()} ${readOnly ? 'READ ONLY' : 'READ WRITE'}`,
    );
    began = true;
    await client.query("SELECT set_config('statement_timeout', $1, true)", [String(timeout)]);
    logger.debug('Transaction started');

    const result = await fn(ctx);
    signal?.throwIfAborted();
    if (expired || Date.now() >= deadline) {
      throw new Error(`Transaction timed out after ${timeout}ms`);
    }
    committing = true;
    const acknowledgement = await client.query('COMMIT');
    commitAcknowledged = true;
    began = false;
    if (acknowledgement.command === 'ROLLBACK') {
      throw new Error('Transaction was rolled back instead of committed');
    }
    if (acknowledgement.command !== 'COMMIT') {
      discard = true;
      throw new Error(
        'Transaction commit outcome is unknown; unexpected acknowledgement; no automatic retry is safe',
      );
    }

    return result;
  } catch (error) {
    if (committing && !commitAcknowledged) {
      discard = true;
      throw new Error('Transaction commit outcome is unknown; no automatic retry is safe', {
        cause: error,
      });
    }
    if (!(began || commitAcknowledged)) {
      discard = true;
    } else if (began) {
      try {
        await client.query('ROLLBACK');
        logger.debug('Transaction rolled back');
      } catch (rollbackError) {
        discard = true;
        logger.error(`Rollback failed: ${rollbackError}`);
      }
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    try {
      client.release(discard);
    } catch (releaseError) {
      // Do not replace an operation error or misreport a confirmed commit.
      logger.warn(`Transaction client release failed: ${releaseError}`);
    }
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
