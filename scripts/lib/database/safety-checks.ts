/**
 * Database Safety Checks
 *
 * Provides safety utilities for database operations.
 *
 * @dependencies
 * - scripts/lib/index.ts - Logger, CI detection, and confirmation utilities
 * - scripts/lib/database/connection.ts - Database connection interface
 */

import { createLogger, isCI, type Logger, confirm as promptConfirm } from '../index.js'
import type { DatabaseConnection } from './connection.js'

export interface SafetyCheckResult {
  safe: boolean
  warnings: string[]
  errors: string[]
  requiresConfirmation: boolean
}

export interface SafetyCheckOptions {
  /** Whether to allow destructive operations */
  allowDestructive?: boolean
  /** Whether to skip confirmation prompts */
  skipConfirmation?: boolean
  /** Whether to require --force flag in CI */
  requireForceInCI?: boolean
  /** Logger instance */
  logger?: Logger
}

const defaultLogger = createLogger({ level: 'silent' })

/**
 * Checks if a destructive database operation is safe to perform.
 */
export async function checkDestructiveOperation(
  connection: DatabaseConnection,
  _operationType: 'reset' | 'drop' | 'truncate' | 'delete',
  options: SafetyCheckOptions = {},
): Promise<SafetyCheckResult> {
  const {
    allowDestructive = true,
    skipConfirmation: _skipConfirmation = false,
    requireForceInCI = true,
    logger = defaultLogger,
  } = options

  const result: SafetyCheckResult = {
    safe: true,
    warnings: [],
    errors: [],
    requiresConfirmation: false,
  }

  // Check CI environment
  if (isCI() && requireForceInCI && !process.env.FORCE_DB_OPERATION) {
    result.errors.push('Running in CI environment. Set FORCE_DB_OPERATION=1 or use --force flag.')
    result.safe = false
  }

  // Check production environment
  if (process.env.NODE_ENV === 'production') {
    result.errors.push('Cannot perform destructive operations in production environment.')
    result.safe = false
  }

  // Check connection string for production indicators
  const connectionString = connection.pool.options.connectionString || ''
  const productionIndicators = ['prod', 'production', 'live', 'main-db']

  for (const indicator of productionIndicators) {
    if (connectionString.toLowerCase().includes(indicator)) {
      result.warnings.push(
        `Connection string contains "${indicator}" - this may be a production database.`,
      )
      result.requiresConfirmation = true
    }
  }

  // Check if database has data
  try {
    const tableCountResult = await connection.query<{ count: string }>(`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const tableCount = parseInt(tableCountResult.rows[0]?.count || '0', 10)

    if (tableCount > 0) {
      // Check total row count
      const tables = await connection.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `)

      let totalRows = 0
      for (const { tablename } of tables.rows) {
        try {
          const countResult = await connection.query<{ count: string }>(
            `SELECT COUNT(*) as count FROM "${tablename}"`,
          )
          totalRows += parseInt(countResult.rows[0]?.count || '0', 10)
        } catch {
          // Table might have issues, skip
        }
      }

      if (totalRows > 0) {
        result.warnings.push(`Database contains ${totalRows} rows across ${tableCount} tables.`)
        result.requiresConfirmation = true
      }
    }
  } catch (error) {
    result.warnings.push(`Could not check database contents: ${error}`)
  }

  if (!allowDestructive) {
    result.errors.push('Destructive operations are not allowed with current configuration.')
    result.safe = false
  }

  // Log results
  for (const error of result.errors) {
    logger.error(error)
  }
  for (const warning of result.warnings) {
    logger.warn(warning)
  }

  return result
}

/**
 * Prompts for confirmation before a destructive operation.
 */
export async function confirmDestructiveOperation(
  operationType: string,
  options: { skipConfirmation?: boolean; logger?: Logger } = {},
): Promise<boolean> {
  const { skipConfirmation = false, logger = defaultLogger } = options

  if (skipConfirmation) {
    logger.debug('Skipping confirmation (--confirm flag)')
    return true
  }

  if (!process.stdin.isTTY) {
    logger.error('Cannot prompt for confirmation in non-interactive mode.')
    logger.info('Use --confirm flag to skip confirmation.')
    return false
  }

  logger.warn(`You are about to perform a destructive operation: ${operationType}`)
  logger.warn('This action cannot be undone.')

  return promptConfirm('Are you sure you want to continue?')
}

/**
 * Validates that required environment variables are set for database operations.
 */
export function validateDatabaseEnv(
  requiredVars: string[] = ['POSTGRES_URL'],
  options: { logger?: Logger } = {},
): { valid: boolean; missing: string[] } {
  const { logger = defaultLogger } = options
  const missing: string[] = []

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`)
    return { valid: false, missing }
  }

  return { valid: true, missing: [] }
}

/**
 * Checks if the database is healthy.
 */
export async function checkDatabaseHealth(
  connection: DatabaseConnection,
  options: { logger?: Logger; timeout?: number } = {},
): Promise<{ healthy: boolean; latency: number; error?: string }> {
  const { logger = defaultLogger, timeout = 5000 } = options
  const start = Date.now()

  try {
    // Set a timeout for the query
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timed out')), timeout)
    })

    const queryPromise = connection.query('SELECT 1 as health_check')

    await Promise.race([queryPromise, timeoutPromise])

    const latency = Date.now() - start
    logger.debug(`Database health check passed (${latency}ms)`)

    return { healthy: true, latency }
  } catch (error) {
    const latency = Date.now() - start
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error(`Database health check failed: ${errorMessage}`)

    return { healthy: false, latency, error: errorMessage }
  }
}

/**
 * Creates a read-only transaction for safe querying.
 */
export async function withReadOnlyTransaction<T>(
  connection: DatabaseConnection,
  fn: (
    query: (sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }>,
  ) => Promise<T>,
): Promise<T> {
  const client = await connection.connect()

  try {
    await client.query('BEGIN READ ONLY')

    const result = await fn(async (sql: string, params?: unknown[]) => {
      const queryResult = await client.query(sql, params)
      return {
        rows: queryResult.rows as T[],
        rowCount: queryResult.rowCount ?? 0,
      }
    })

    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
