/**
 * Test Database Setup
 *
 * Utilities for setting up and tearing down test databases.
 * Uses Drizzle ORM with node-postgres for localhost connections.
 */

import { logger } from '@revealui/core/utils/logger'
import { sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { closeAllPools, createClient, type Database } from '../src/client/index.js'
import * as schema from '../src/schema/index.js'

/**
 * Test database configuration
 */
export interface TestDatabaseConfig {
  /** Database URL for testing */
  url?: string
  /** Whether to log database operations */
  logging?: boolean
  /** Whether to seed initial data */
  seed?: boolean
}

const defaultConfig: TestDatabaseConfig = {
  url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  logging: false,
  seed: false,
}

let isSetup = false
let testDb: Database | null = null

/** Signal used to force transaction rollback in withTestTransaction */
class RollbackSignal extends Error {
  constructor() {
    super('Test transaction rollback')
    this.name = 'RollbackSignal'
  }
}

/** Table name to Drizzle table mapping for seeding */
const seedableTables: Record<string, unknown> = {
  users: schema.users,
  sessions: schema.sessions,
  sites: schema.sites,
  siteCollaborators: schema.siteCollaborators,
  pages: schema.pages,
  pageRevisions: schema.pageRevisions,
  posts: schema.posts,
  media: schema.media,
}

/**
 * Set up test database
 *
 * Should be called once before all tests (in vitest.setup.ts or beforeAll)
 */
export async function setupTestDatabase(config: TestDatabaseConfig = {}): Promise<void> {
  if (isSetup) {
    logger.debug('Test database already set up')
    return
  }

  const finalConfig = { ...defaultConfig, ...config }

  if (!finalConfig.url) {
    throw new Error(
      'Test database URL not provided. Set TEST_DATABASE_URL or DATABASE_URL environment variable.',
    )
  }

  try {
    logger.info('Setting up test database', { url: finalConfig.url })

    testDb = createClient({
      connectionString: finalConfig.url,
      logger: finalConfig.logging,
    })

    // Verify connection works
    const db = testDb as NodePgDatabase<typeof schema>
    await db.execute(sql`SELECT 1`)

    if (finalConfig.seed) {
      await seedTestDatabase()
    }

    isSetup = true
    logger.info('Test database setup complete')
  } catch (error) {
    logger.error('Failed to set up test database', { error })
    throw error
  }
}

/**
 * Tear down test database
 *
 * Should be called once after all tests (in vitest.setup.ts or afterAll)
 */
export async function teardownTestDatabase(): Promise<void> {
  if (!isSetup) {
    logger.debug('Test database not set up, skipping teardown')
    return
  }

  try {
    logger.info('Tearing down test database')

    await closeAllPools()

    testDb = null
    isSetup = false

    logger.info('Test database teardown complete')
  } catch (error) {
    logger.error('Failed to tear down test database', { error })
    throw error
  }
}

/**
 * Reset test database to clean state
 *
 * Should be called between tests (in beforeEach) to ensure isolation
 */
export async function resetTestDatabase(): Promise<void> {
  if (!(isSetup && testDb)) {
    throw new Error('Test database not set up. Call setupTestDatabase() first.')
  }

  try {
    logger.debug('Resetting test database')

    const db = testDb as NodePgDatabase<typeof schema>

    // Truncate all user tables in public schema, respecting FK constraints
    await db.execute(sql`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$
    `)

    logger.debug('Test database reset complete')
  } catch (error) {
    logger.error('Failed to reset test database', { error })
    throw error
  }
}

/**
 * Seed test database with initial data
 *
 * Keys must match table variable names from the schema (e.g., 'users', 'sites').
 */
export async function seedTestDatabase(data?: {
  [key: string]: unknown[] | undefined
}): Promise<void> {
  if (!(isSetup && testDb)) {
    throw new Error('Test database not set up. Call setupTestDatabase() first.')
  }

  try {
    logger.debug('Seeding test database')

    const db = testDb as NodePgDatabase<typeof schema>

    for (const [tableName, rows] of Object.entries(data ?? {})) {
      if (!rows?.length) continue
      const table = seedableTables[tableName]
      if (!table) {
        logger.warn(`Unknown table "${tableName}" in seed data, skipping`)
        continue
      }
      // biome-ignore lint/suspicious/noExplicitAny: test utility uses dynamic table types
      await db.insert(table as any).values(rows as any)
    }

    logger.debug('Test database seeding complete')
  } catch (error) {
    logger.error('Failed to seed test database', { error })
    throw error
  }
}

/**
 * Execute raw SQL query (for test setup/assertions)
 *
 * For parameterized queries, use getTestDatabase() with Drizzle's sql template literals.
 */
export async function executeTestQuery<T = unknown>(
  query: string,
  _params?: unknown[],
): Promise<T[]> {
  if (!(isSetup && testDb)) {
    throw new Error('Test database not set up. Call setupTestDatabase() first.')
  }

  try {
    const db = testDb as NodePgDatabase<typeof schema>
    const result = await db.execute(sql.raw(query))
    // node-postgres returns QueryResult with .rows
    return (result as unknown as { rows: T[] }).rows ?? []
  } catch (error) {
    logger.error('Failed to execute test query', { error, query })
    throw error
  }
}

/**
 * Get test database connection
 */
export function getTestDatabase(): Database {
  if (!(isSetup && testDb)) {
    throw new Error('Test database not set up. Call setupTestDatabase() first.')
  }
  return testDb
}

/**
 * Check if test database is set up
 */
export function isTestDatabaseSetup(): boolean {
  return isSetup
}

/**
 * Transaction helper for test isolation
 *
 * Runs a test within a transaction that is automatically rolled back,
 * ensuring database changes don't leak between tests. During execution,
 * getTestDatabase() returns the transaction-scoped client.
 */
export async function withTestTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!(isSetup && testDb)) {
    throw new Error('Test database not set up. Call setupTestDatabase() first.')
  }

  const db = testDb as NodePgDatabase<typeof schema>
  let result: T
  const originalDb = testDb

  try {
    await db.transaction(async (tx) => {
      logger.debug('Starting test transaction')
      // Swap testDb so getTestDatabase() returns the transaction during the test
      testDb = tx as unknown as Database
      result = await fn()
      // Force rollback by throwing a known signal
      throw new RollbackSignal()
    })
  } catch (error) {
    if (error instanceof RollbackSignal) {
      logger.debug('Rolling back test transaction')
      testDb = originalDb
      return result!
    }
    logger.debug('Rolling back test transaction due to error')
    testDb = originalDb
    throw error
  }

  testDb = originalDb
  return result!
}
