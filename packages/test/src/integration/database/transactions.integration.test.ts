/**
 * Database transactions integration tests
 *
 * Tests transaction rollback, commit, nested transactions, and isolation
 */

import type { DatabaseAdapter } from '@revealui/core/types'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDatabase } from '../../utils/integration-helpers.js'

describe('Database Transactions Integration', () => {
  let db: DatabaseAdapter

  beforeAll(async () => {
    db = await setupTestDatabase()

    // Create test table - drop first to ensure clean state
    try {
      await db.query('DROP TABLE IF EXISTS test_table')
    } catch {
      // Ignore errors
    }

    await db.query(`
      CREATE TABLE test_table (
        id TEXT PRIMARY KEY,
        name TEXT,
        value INTEGER
      )
    `)
  })

  beforeEach(async () => {
    // Clean up any existing test data before each test
    await db.query('DELETE FROM test_table')
  })

  afterEach(async () => {
    // Clean up after each test for complete isolation
    await db.query('DELETE FROM test_table')
  })

  describe('Transaction Commit', () => {
    it('should commit transaction successfully', async () => {
      // Use unique IDs to avoid conflicts
      const id1 = `tx-commit-1-${Date.now()}`
      const id2 = `tx-commit-2-${Date.now()}`

      // Use syncQuery for proper transactional behavior with better-sqlite3
      await db.transaction((syncQuery) => {
        if (!syncQuery) {
          throw new Error('syncQuery not provided')
        }
        syncQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', [id1, 'Test1'])
        syncQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', [id2, 'Test2'])
      })

      const result = await db.query('SELECT * FROM test_table WHERE id IN (?, ?)', [id1, id2])
      expect(result.rows).toHaveLength(2)

      // Cleanup
      await db.query('DELETE FROM test_table WHERE id IN (?, ?)', [id1, id2])
    })
  })

  describe('Transaction Rollback', () => {
    it('should rollback transaction on error', async () => {
      // Use unique ID to avoid conflicts
      const id = `tx-rollback-${Date.now()}`

      try {
        // Use syncQuery for proper transactional behavior with better-sqlite3
        await db.transaction((syncQuery) => {
          if (!syncQuery) {
            throw new Error('syncQuery not provided')
          }
          syncQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', [id, 'Test1'])
          throw new Error('Test error')
        })
      } catch (error) {
        // Expected error
        expect((error as Error).message).toBe('Test error')
      }

      const result = await db.query('SELECT * FROM test_table WHERE id = ?', [id])
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('Transaction Isolation', () => {
    it('should isolate concurrent transactions', async () => {
      // This test verifies that transactions are isolated
      // In SQLite, transactions are serialized, so this test verifies basic behavior
      const id = `tx-isolated-${Date.now()}`

      // Use syncQuery for proper transactional behavior with better-sqlite3
      await db.transaction((syncQuery) => {
        if (!syncQuery) {
          throw new Error('syncQuery not provided')
        }
        syncQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', [id, 'Test1'])

        // Read within transaction using syncQuery
        const result = syncQuery('SELECT * FROM test_table WHERE id = ?', [id])
        expect(result.rows).toHaveLength(1)
      })

      // Verify committed
      const result = await db.query('SELECT * FROM test_table WHERE id = ?', [id])
      expect(result.rows).toHaveLength(1)

      // Cleanup
      await db.query('DELETE FROM test_table WHERE id = ?', [id])
    })
  })

  describe('Nested Transactions', () => {
    it('should handle nested transaction-like operations', async () => {
      // Note: SQLite doesn't support true nested transactions,
      // but we can test that the adapter handles the pattern gracefully
      const id1 = `tx-nested-1-${Date.now()}`
      const id2 = `tx-nested-2-${Date.now()}`

      // Use syncQuery for proper transactional behavior with better-sqlite3
      await db.transaction((syncQuery) => {
        if (!syncQuery) {
          throw new Error('syncQuery not provided')
        }
        syncQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', [id1, 'Test1'])

        // Nested operation (would be in inner transaction if supported)
        syncQuery('INSERT INTO test_table (id, name) VALUES (?, ?)', [id2, 'Test2'])
      })

      const result = await db.query('SELECT * FROM test_table WHERE id IN (?, ?)', [id1, id2])
      expect(result.rows).toHaveLength(2)

      // Cleanup
      await db.query('DELETE FROM test_table WHERE id IN (?, ?)', [id1, id2])
    })
  })
})
