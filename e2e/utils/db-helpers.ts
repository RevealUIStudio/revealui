/**
 * Database E2E Test Helpers
 *
 * Utilities for testing database operations through the full stack:
 * Browser interaction → API → Database
 *
 * Uses MCP server integration for database verification
 */

import { type Page } from '@playwright/test'
import type { Pool, PoolClient } from 'pg'

/**
 * Database connection configuration
 */
export interface DbConfig {
  connectionString?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
}

/**
 * Database query result
 */
export interface DbQueryResult<T = unknown> {
  rows: T[]
  rowCount: number
  command: string
}

/**
 * Database test helper class
 */
export class DbTestHelper {
  private pool: Pool | null = null
  private client: PoolClient | null = null

  constructor(private config: DbConfig) {}

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    const { Pool } = await import('pg')

    this.pool = new Pool({
      connectionString: this.config.connectionString ||
        `postgresql://${this.config.user}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })

    this.client = await this.pool.connect()
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release()
      this.client = null
    }
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  /**
   * Execute a query
   */
  async query<T = unknown>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>> {
    if (!this.client) {
      throw new Error('Database not connected. Call connect() first.')
    }

    const result = await this.client.query(sql, params)
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      command: result.command,
    }
  }

  /**
   * Get a single row by ID
   */
  async getById<T = unknown>(table: string, id: string | number): Promise<T | null> {
    const result = await this.query<T>(
      `SELECT * FROM ${table} WHERE id = $1 LIMIT 1`,
      [id]
    )
    return result.rows[0] || null
  }

  /**
   * Get all rows from a table with optional conditions
   */
  async getAll<T = unknown>(
    table: string,
    where?: { column: string; value: unknown }
  ): Promise<T[]> {
    let sql = `SELECT * FROM ${table}`
    const params: unknown[] = []

    if (where) {
      sql += ` WHERE ${where.column} = $1`
      params.push(where.value)
    }

    const result = await this.query<T>(sql, params)
    return result.rows
  }

  /**
   * Insert a record and return the created row
   */
  async insert<T = unknown>(
    table: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

    const sql = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await this.query<T>(sql, values)
    return result.rows[0]
  }

  /**
   * Update a record by ID
   */
  async update<T = unknown>(
    table: string,
    id: string | number,
    data: Record<string, unknown>
  ): Promise<T | null> {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const setClause = columns.map((col, i) => `${col} = $${i + 2}`).join(', ')

    const sql = `
      UPDATE ${table}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `

    const result = await this.query<T>(sql, [id, ...values])
    return result.rows[0] || null
  }

  /**
   * Delete a record by ID
   */
  async delete(table: string, id: string | number): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM ${table} WHERE id = $1`,
      [id]
    )
    return result.rowCount > 0
  }

  /**
   * Count rows in a table with optional conditions
   */
  async count(
    table: string,
    where?: { column: string; value: unknown }
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${table}`
    const params: unknown[] = []

    if (where) {
      sql += ` WHERE ${where.column} = $1`
      params.push(where.value)
    }

    const result = await this.query<{ count: string }>(sql, params)
    return Number.parseInt(result.rows[0].count, 10)
  }

  /**
   * Truncate a table (delete all rows)
   */
  async truncate(table: string, cascade = false): Promise<void> {
    const sql = `TRUNCATE TABLE ${table}${cascade ? ' CASCADE' : ''}`
    await this.query(sql)
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    await this.query('BEGIN')
  }

  /**
   * Commit a transaction
   */
  async commit(): Promise<void> {
    await this.query('COMMIT')
  }

  /**
   * Rollback a transaction
   */
  async rollback(): Promise<void> {
    await this.query('ROLLBACK')
  }

  /**
   * Execute a function within a transaction
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.beginTransaction()
    try {
      const result = await fn()
      await this.commit()
      return result
    } catch (error) {
      await this.rollback()
      throw error
    }
  }
}

/**
 * Wait for database record to be created
 */
export async function waitForDbRecord<T = unknown>(
  db: DbTestHelper,
  table: string,
  where: { column: string; value: unknown },
  timeoutMs = 5000
): Promise<T | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const records = await db.getAll<T>(table, where)
    if (records.length > 0) {
      return records[0]
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return null
}

/**
 * Wait for database record to be updated
 */
export async function waitForDbUpdate<T = unknown>(
  db: DbTestHelper,
  table: string,
  id: string | number,
  expectedValue: Record<string, unknown>,
  timeoutMs = 5000
): Promise<T | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const record = await db.getById<T>(table, id)
    if (record) {
      const matches = Object.entries(expectedValue).every(
        ([key, value]) => (record as Record<string, unknown>)[key] === value
      )
      if (matches) {
        return record
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return null
}

/**
 * Verify database state after browser action
 */
export async function verifyDbState<T = unknown>(
  db: DbTestHelper,
  table: string,
  where: { column: string; value: unknown }
): Promise<T[]> {
  // Small delay to ensure async operations complete
  await new Promise(resolve => setTimeout(resolve, 500))
  return db.getAll<T>(table, where)
}

/**
 * Seed test data
 */
export async function seedTestData(
  db: DbTestHelper,
  table: string,
  data: Record<string, unknown>[]
): Promise<void> {
  for (const item of data) {
    await db.insert(table, item)
  }
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  db: DbTestHelper,
  table: string,
  where?: { column: string; value: unknown }
): Promise<void> {
  if (where) {
    await db.query(
      `DELETE FROM ${table} WHERE ${where.column} = $1`,
      [where.value]
    )
  } else {
    await db.truncate(table)
  }
}

/**
 * Intercept and log database queries from the browser
 */
export async function interceptDbQueries(page: Page): Promise<string[]> {
  const queries: string[] = []

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const response = await route.fetch()
    const responseBody = await response.text()

    // Log query information
    queries.push(JSON.stringify({
      url: request.url(),
      method: request.method(),
      status: response.status(),
      body: responseBody,
    }))

    await route.fulfill({ response })
  })

  return queries
}

/**
 * Create a test database connection from environment
 */
export function createTestDb(): DbTestHelper {
  return new DbTestHelper({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    host: process.env.PGHOST || 'localhost',
    port: Number.parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'revealui_test',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  })
}
