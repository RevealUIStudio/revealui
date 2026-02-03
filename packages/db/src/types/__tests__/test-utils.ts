/**
 * Test utilities for database type integration tests
 *
 * Provides helpers for setting up test database connections and fixtures.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../../schema/index.js'

/**
 * Get test database connection string from environment
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL

  if (!url) {
    throw new Error(
      'Test database URL not found. Set TEST_POSTGRES_URL, POSTGRES_URL, or DATABASE_URL',
    )
  }

  return url
}

/**
 * Create a test database client
 */
export function createTestClient() {
  const connectionString = getTestDatabaseUrl()
  const sql = neon(connectionString)

  return drizzle({
    client: sql,
    schema,
  })
}

/**
 * Clean up test data (placeholder - implement as needed)
 */
export async function cleanupTestData(db: ReturnType<typeof createTestClient>): Promise<void> {
  // Implement cleanup logic as needed
  // For now, this is a placeholder
  void db
}
