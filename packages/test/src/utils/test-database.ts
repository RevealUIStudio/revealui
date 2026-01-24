/**
 * Test database utilities
 *
 * Provides utilities for test database setup, teardown, seeding, and cleanup
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sqliteAdapter } from '@revealui/core/database/sqlite'
import type { DatabaseAdapter } from '@revealui/core/types'

type TestDatabaseAdapter = DatabaseAdapter & { __testDbPath?: string }

let testDb: TestDatabaseAdapter | null = null

/**
 * Setup test database
 */
export async function setupTestDatabase(dbPath?: string): Promise<DatabaseAdapter> {
  if (testDb) {
    return testDb
  }

  const finalDbPath = dbPath || path.join(os.tmpdir(), `revealui-test-${Date.now()}.sqlite`)

  testDb = sqliteAdapter({
    client: {
      url: finalDbPath,
    },
  })

  await testDb.init()
  await testDb.connect()

  // Store path for cleanup
  testDb.__testDbPath = finalDbPath

  return testDb
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testDb) {
    try {
      await testDb.close()
      const dbPath = testDb.__testDbPath
      if (dbPath && fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
    testDb = null
  }
}

/**
 * Seed test data
 */
export async function seedTestData(
  db: DatabaseAdapter,
  tableName: string,
  data: Array<Record<string, unknown>>,
): Promise<void> {
  // Create table if it doesn't exist
  // Note: This is a simplified version - actual implementation would use RevealUI collections

  for (const item of data) {
    const columns = Object.keys(item).join(', ')
    const placeholders = Object.keys(item)
      .map(() => '?')
      .join(', ')
    const values = Object.values(item)

    await db.query(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values)
  }
}

/**
 * Cleanup test data
 */
export async function cleanupTestData(
  db: DatabaseAdapter,
  tableName: string,
  whereClause?: string,
  whereValues?: unknown[],
): Promise<void> {
  if (whereClause) {
    await db.query(`DELETE FROM ${tableName} WHERE ${whereClause}`, whereValues || [])
  } else {
    await db.query(`DELETE FROM ${tableName}`)
  }
}
