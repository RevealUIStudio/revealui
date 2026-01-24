/**
 * Example: Testing Database Queries
 *
 * This file demonstrates how to test database queries, transactions, and query builders
 *
 * Usage: Copy patterns from this file to your actual test files
 */

import type { DatabaseAdapter } from '@revealui/core/types'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupTestDatabase, teardownTestDatabase } from '../utils/test-database'

describe('Database Query Testing Patterns', () => {
  let db: DatabaseAdapter

  beforeEach(async () => {
    db = await setupTestDatabase()
    // Create test table
    await db.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT
      )
    `)
  })

  afterEach(async () => {
    await db.query('DROP TABLE IF EXISTS test_users')
    await teardownTestDatabase()
  })

  describe('Query Execution', () => {
    it('should execute SELECT queries', async () => {
      const result = await db.query('SELECT * FROM test_users')

      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)
    })

    it('should execute INSERT queries', async () => {
      await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
        '1',
        'test@example.com',
        'Test User',
      ])

      const result = await db.query('SELECT * FROM test_users WHERE id = ?', ['1'])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].email).toBe('test@example.com')
    })

    it('should execute UPDATE queries', async () => {
      await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
        '1',
        'test@example.com',
        'Test User',
      ])

      await db.query('UPDATE test_users SET name = ? WHERE id = ?', ['Updated Name', '1'])

      const result = await db.query('SELECT * FROM test_users WHERE id = ?', ['1'])
      expect(result.rows[0].name).toBe('Updated Name')
    })

    it('should execute DELETE queries', async () => {
      await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
        '1',
        'test@example.com',
        'Test User',
      ])

      await db.query('DELETE FROM test_users WHERE id = ?', ['1'])

      const result = await db.query('SELECT * FROM test_users')
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('Transactions', () => {
    it('should commit transaction successfully', async () => {
      await db.transaction(async () => {
        await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
          '1',
          'test1@example.com',
          'User 1',
        ])
        await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
          '2',
          'test2@example.com',
          'User 2',
        ])
      })

      const result = await db.query('SELECT * FROM test_users')
      expect(result.rows).toHaveLength(2)
    })

    it('should rollback transaction on error', async () => {
      try {
        await db.transaction(async () => {
          await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
            '1',
            'test@example.com',
            'Test User',
          ])
          throw new Error('Test error')
        })
      } catch (_error) {
        // Expected error
      }

      const result = await db.query('SELECT * FROM test_users')
      expect(result.rows).toHaveLength(0)
    })
  })

  describe('Query Builders', () => {
    it('should build WHERE clauses', () => {
      // Example: Using query builder utilities
      // const whereClause = buildWhereClause({ email: { equals: 'test@example.com' } }, [])
      // expect(whereClause).toContain('email')
    })

    it('should handle parameterized queries', async () => {
      await db.query('INSERT INTO test_users (id, email, name) VALUES (?, ?, ?)', [
        '1',
        'test@example.com',
        'Test User',
      ])

      const result = await db.query('SELECT * FROM test_users WHERE email = ?', [
        'test@example.com',
      ])
      expect(result.rows).toHaveLength(1)
    })
  })

  describe('Migrations', () => {
    it('should apply migrations', async () => {
      // Example: Test migration scripts
      // await runMigration('001_create_users_table.sql')
      // const result = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      // expect(result.rows).toHaveLength(1)
    })
  })
})
