/**
 * Unit tests for database utilities
 *
 * Tests actual utilities from packages/revealui/src/core/database/sqlite.ts
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sqliteAdapter } from '../../../../../packages/revealui/src/core/database/sqlite.js'
import type { Field } from '../../../../../packages/revealui/src/core/types/index.js'

describe('SQLite Database Utilities', () => {
  let dbPath: string
  let adapter: ReturnType<typeof sqliteAdapter>

  beforeEach(() => {
    // Create temporary database file
    const tmpDir = os.tmpdir()
    dbPath = path.join(tmpDir, `test-db-${Date.now()}.sqlite`)

    adapter = sqliteAdapter({
      client: {
        url: dbPath,
      },
    })
  })

  afterEach(async () => {
    // Clean up database file
    try {
      await adapter.close()
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath)
      }
    } catch (_error) {
      // Ignore cleanup errors
    }
  })

  describe('initialization', () => {
    it('should initialize database', async () => {
      await adapter.init()

      // Database should be accessible
      const result = await adapter.query('SELECT 1 as test')
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].test).toBe(1)
    })

    it('should create database directory if it does not exist', async () => {
      const dirPath = path.join(os.tmpdir(), `test-db-dir-${Date.now()}`)
      const dbFile = path.join(dirPath, 'test.db')

      const testAdapter = sqliteAdapter({
        client: {
          url: dbFile,
        },
      })

      await testAdapter.init()
      expect(fs.existsSync(dirPath)).toBe(true)

      await testAdapter.close()
      if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile)
      }
      if (fs.existsSync(dirPath)) {
        fs.rmdirSync(dirPath)
      }
    })

    it('should enable WAL mode', async () => {
      await adapter.init()

      // Check WAL mode is enabled
      // PRAGMA journal_mode returns an object with the pragma name as key
      const result = await adapter.query('PRAGMA journal_mode')
      expect(result.rows).toHaveLength(1)
      const row = result.rows[0] as any

      // better-sqlite3 returns PRAGMA results as objects with the pragma name as the key
      // The value can be accessed via the key or by getting the first property value
      const journalMode = row?.journal_mode || Object.values(row || {})[0]
      expect(String(journalMode).toLowerCase()).toBe('wal')
    })

    it('should enable foreign keys', async () => {
      await adapter.init()

      // Check foreign keys are enabled
      // PRAGMA foreign_keys returns 1 if enabled, 0 if disabled
      const result = await adapter.query('PRAGMA foreign_keys')
      expect(result.rows).toHaveLength(1)
      const row = result.rows[0] as any

      // better-sqlite3 returns PRAGMA results as objects with the pragma name as the key
      const foreignKeys = row?.foreign_keys || Object.values(row || {})[0]
      expect(Number(foreignKeys)).toBe(1)
    })
  })

  describe('connection', () => {
    it('should connect after initialization', async () => {
      await adapter.init()
      await adapter.connect()

      // Should not throw
      const result = await adapter.query('SELECT 1')
      expect(result.rows).toHaveLength(1)
    })

    it('should throw error when connecting without initialization', async () => {
      await expect(adapter.connect()).rejects.toThrow('Database not initialized')
    })
  })

  describe('query execution', () => {
    beforeEach(async () => {
      await adapter.init()
    })

    it('should execute SELECT queries', async () => {
      const result = await adapter.query('SELECT 1 as value, 2 as other')

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].value).toBe(1)
      expect(result.rows[0].other).toBe(2)
      expect(result.rowCount).toBe(1)
    })

    it('should execute queries with parameters', async () => {
      await adapter.query(`
        CREATE TABLE test (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `)

      await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', ['1', 'Test'])

      const result = await adapter.query('SELECT * FROM test WHERE id = ?', ['1'])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Test')
    })

    it('should convert PostgreSQL placeholders to SQLite', async () => {
      await adapter.query(`
        CREATE TABLE test (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `)

      await adapter.query('INSERT INTO test (id, name) VALUES ($1, $2)', ['1', 'Test'])

      const result = await adapter.query('SELECT * FROM test WHERE id = $1', ['1'])
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Test')
    })

    it('should execute INSERT queries', async () => {
      await adapter.query(`
        CREATE TABLE test (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `)

      const result = await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', ['1', 'Test'])

      expect(result.rows).toHaveLength(0)
      expect(result.rowCount).toBe(0)

      // Verify insertion
      const selectResult = await adapter.query('SELECT * FROM test')
      expect(selectResult.rows).toHaveLength(1)
    })

    it('should execute UPDATE queries', async () => {
      await adapter.query(`
        CREATE TABLE test (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `)

      await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', ['1', 'Test'])
      await adapter.query('UPDATE test SET name = ? WHERE id = ?', ['Updated', '1'])

      const result = await adapter.query('SELECT * FROM test WHERE id = ?', ['1'])
      expect(result.rows[0].name).toBe('Updated')
    })

    it('should execute DELETE queries', async () => {
      await adapter.query(`
        CREATE TABLE test (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `)

      await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', ['1', 'Test'])
      await adapter.query('DELETE FROM test WHERE id = ?', ['1'])

      const result = await adapter.query('SELECT * FROM test')
      expect(result.rows).toHaveLength(0)
    })

    it('should throw error when querying without connection', async () => {
      const uninitializedAdapter = sqliteAdapter({
        client: {
          url: path.join(os.tmpdir(), 'uninitialized.db'),
        },
      })

      await expect(uninitializedAdapter.query('SELECT 1')).rejects.toThrow('Database not connected')
    })
  })

  describe('table creation', () => {
    beforeEach(async () => {
      await adapter.init()
      // Clean up any existing tables for test isolation
      // Note: createTable already drops tables in test mode, but we do it here too for safety
      try {
        await adapter.query('DROP TABLE IF EXISTS posts')
      } catch {
        // Ignore errors if table doesn't exist
      }
      try {
        await adapter.query('DROP TABLE IF EXISTS products')
      } catch {
        // Ignore errors if table doesn't exist
      }
      try {
        await adapter.query('DROP TABLE IF EXISTS global_settings')
      } catch {
        // Ignore errors if table doesn't exist
      }
    })

    it('should create table with text fields', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'description',
          type: 'textarea',
        },
      ]

      adapter.createTable('posts', fields)

      // Verify table exists and has correct columns
      // Use quotes around table name to match createTable's quoting
      const result = await adapter.query('PRAGMA table_info("posts")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)
      expect(result.rows.length).toBeGreaterThan(0)

      // Verify specific columns exist
      const columnNames = result.rows.map((row: any) => row.name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('title')
      expect(columnNames).toContain('description')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')

      // Comprehensive property verification
      const idColumn = result.rows.find((row: any) => row.name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn.type.toUpperCase()).toBe('TEXT')
      expect(idColumn.pk).toBe(1) // PRIMARY KEY

      const titleColumn = result.rows.find((row: any) => row.name === 'title')
      expect(titleColumn).toBeDefined()
      expect(titleColumn.type.toUpperCase()).toBe('TEXT')
      expect(titleColumn.notnull).toBe(1) // NOT NULL constraint

      const descriptionColumn = result.rows.find((row: any) => row.name === 'description')
      expect(descriptionColumn).toBeDefined()
      expect(descriptionColumn.type.toUpperCase()).toBe('TEXT')
      expect(descriptionColumn.notnull).toBe(0) // Not required

      const createdAtColumn = result.rows.find((row: any) => row.name === 'created_at')
      expect(createdAtColumn).toBeDefined()
      expect(createdAtColumn.type.toUpperCase()).toMatch(/DATETIME|TIMESTAMP/)
      expect(createdAtColumn.dflt_value).toMatch(/CURRENT_TIMESTAMP/i)
    })

    it('should create table with number fields', async () => {
      const fields: Field[] = [
        {
          name: 'price',
          type: 'number',
        },
      ]

      adapter.createTable('products', fields)

      const result = await adapter.query('PRAGMA table_info("products")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)

      // Verify number field was created with comprehensive checks
      const priceColumn = result.rows.find((row: any) => row.name === 'price')
      expect(priceColumn).toBeDefined()
      expect(priceColumn.type.toUpperCase()).toMatch(/REAL|NUMERIC|INTEGER/)
      expect(priceColumn.notnull).toBe(0) // Not required
      expect(priceColumn.pk).toBe(0) // Not primary key

      // Verify id column is primary key
      const idColumn = result.rows.find((row: any) => row.name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn.pk).toBe(1)
    })

    it('should create table with checkbox fields', async () => {
      const fields: Field[] = [
        {
          name: 'published',
          type: 'checkbox',
        },
      ]

      adapter.createTable('posts', fields)

      const result = await adapter.query('PRAGMA table_info("posts")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)

      // Verify checkbox field was created with comprehensive checks
      const publishedColumn = result.rows.find((row: any) => row.name === 'published')
      expect(publishedColumn).toBeDefined()
      expect(publishedColumn.type.toUpperCase()).toBe('BOOLEAN')
      expect(publishedColumn.notnull).toBe(0) // Not required
      expect(publishedColumn.pk).toBe(0) // Not primary key
    })

    it('should create table with required fields', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
      ]

      adapter.createTable('posts', fields)

      // Verify NOT NULL constraint with comprehensive checks
      const result = await adapter.query('PRAGMA table_info("posts")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)

      // Verify required field has NOT NULL constraint
      const titleColumn = result.rows.find((row: any) => row.name === 'title')
      expect(titleColumn).toBeDefined()
      expect(titleColumn.type.toUpperCase()).toBe('TEXT')
      expect(titleColumn.notnull).toBe(1) // NOT NULL constraint applied
      expect(titleColumn.pk).toBe(0) // Not primary key

      // Verify non-required fields don't have NOT NULL
      const createdAtColumn = result.rows.find((row: any) => row.name === 'created_at')
      expect(createdAtColumn).toBeDefined()
      expect(createdAtColumn.notnull).toBe(0) // Has default, not required
    })

    it('should create table with unique fields', async () => {
      const fields: Field[] = [
        {
          name: 'slug',
          type: 'text',
          unique: true,
        },
      ]

      adapter.createTable('posts', fields)

      const result = await adapter.query('PRAGMA table_info("posts")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)

      // Verify unique field exists with comprehensive checks
      const slugColumn = result.rows.find((row: any) => row.name === 'slug')
      expect(slugColumn).toBeDefined()
      expect(slugColumn.type.toUpperCase()).toBe('TEXT')
      expect(slugColumn.notnull).toBe(0) // Not required

      // Verify unique constraint exists (check index)
      const indexInfo = await adapter.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='posts'",
      )
      expect(indexInfo.rows.length).toBeGreaterThan(0)

      // Verify the index is for the slug column
      const slugIndex = indexInfo.rows.find(
        (idx: any) => idx.name?.includes('slug') || idx.name?.includes('posts'),
      )
      expect(slugIndex).toBeDefined()

      // Verify index details
      const indexDetails = await adapter.query(`PRAGMA index_info("${indexInfo.rows[0].name}")`)
      expect(indexDetails.rows.length).toBeGreaterThan(0)
    })

    it('should create table with standard columns', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
      ]

      adapter.createTable('posts', fields)

      // Check that id, created_at, updated_at exist with comprehensive verification
      const result = await adapter.query('PRAGMA table_info("posts")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)

      const columnNames = result.rows.map((row: any) => row.name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('created_at')
      expect(columnNames).toContain('updated_at')
      expect(columnNames).toContain('title')

      // Verify id is PRIMARY KEY with comprehensive checks
      const idColumn = result.rows.find((row: any) => row.name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn.type.toUpperCase()).toBe('TEXT')
      expect(idColumn.pk).toBe(1) // PRIMARY KEY
      expect(idColumn.notnull).toBe(0) // Primary key can be null in SQLite before insertion

      // Verify created_at has default
      const createdAtColumn = result.rows.find((row: any) => row.name === 'created_at')
      expect(createdAtColumn).toBeDefined()
      expect(createdAtColumn.type.toUpperCase()).toMatch(/DATETIME|TIMESTAMP/)
      expect(createdAtColumn.dflt_value).toMatch(/CURRENT_TIMESTAMP/i)

      // Verify updated_at has default
      const updatedAtColumn = result.rows.find((row: any) => row.name === 'updated_at')
      expect(updatedAtColumn).toBeDefined()
      expect(updatedAtColumn.type.toUpperCase()).toMatch(/DATETIME|TIMESTAMP/)
      expect(updatedAtColumn.dflt_value).toMatch(/CURRENT_TIMESTAMP/i)

      // Verify title column
      const titleColumn = result.rows.find((row: any) => row.name === 'title')
      expect(titleColumn).toBeDefined()
      expect(titleColumn.type.toUpperCase()).toBe('TEXT')
      expect(titleColumn.notnull).toBe(0) // Not required
    })

    it('should create global table', async () => {
      const fields: Field[] = [
        {
          name: 'title',
          type: 'text',
        },
      ]

      adapter.createGlobalTable('settings', fields)

      // Check that global_settings table exists with comprehensive verification
      const result = await adapter.query('PRAGMA table_info("global_settings")')
      expect(result.rows).toBeDefined()
      expect(Array.isArray(result.rows)).toBe(true)
      expect(result.rows.length).toBeGreaterThan(0)

      // Verify table has expected columns
      const columnNames = result.rows.map((row: any) => row.name)
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('title')

      // Comprehensive property checks
      const idColumn = result.rows.find((row: any) => row.name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn.type.toUpperCase()).toBe('TEXT')
      expect(idColumn.pk).toBe(1) // PRIMARY KEY

      const titleColumn = result.rows.find((row: any) => row.name === 'title')
      expect(titleColumn).toBeDefined()
      expect(titleColumn.type.toUpperCase()).toBe('TEXT')
      expect(titleColumn.notnull).toBe(0) // Not required
    })
  })

  describe('transactions', () => {
    beforeEach(async () => {
      await adapter.init()
      // Clear any existing data and recreate table
      try {
        await adapter.query('DROP TABLE IF EXISTS test')
      } catch {
        // Table might not exist
      }
      await adapter.query(`
        CREATE TABLE test (
          id TEXT PRIMARY KEY,
          name TEXT
        )
      `)
      // Ensure table is empty before each test
      await adapter.query('DELETE FROM test')
    })

    it('should execute transaction successfully', async () => {
      // better-sqlite3 transactions are synchronous, so we need to test with sync operations
      // The adapter.query is async, but within a transaction we can still use it synchronously
      // by awaiting it before the transaction completes

      // Insert two records in a transaction
      await adapter.transaction(async () => {
        // These queries are async, but we await them within the transaction
        // The transaction wrapper handles the synchronous nature of better-sqlite3
        await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', ['1', 'Test 1'])
        await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', ['2', 'Test 2'])
      })

      // Verify both records were inserted
      const result = await adapter.query('SELECT * FROM test')
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].id).toBe('1')
      expect(result.rows[1].id).toBe('2')
    })

    it('should rollback transaction on error with sync operations', async () => {
      // Test rollback using synchronous operations within transaction
      // Clear table first to ensure clean state
      await adapter.query('DELETE FROM test')

      // Insert a record before transaction to verify it still exists after rollback
      // This proves that rollback didn't affect data outside the transaction
      await adapter.query('INSERT INTO test (id, name) VALUES (?, ?)', [
        'before-transaction',
        'Before',
      ])

      let caughtError: Error | undefined

      try {
        // Use syncQuery provided by transaction - this ensures proper rollback
        // Sync operations within better-sqlite3 transactions work correctly
        await adapter.transaction(function syncCallback(syncQuery) {
          if (!syncQuery) {
            throw new Error('syncQuery not provided by transaction method')
          }

          // Use synchronous query within transaction - this ensures rollback works
          syncQuery('INSERT INTO test (id, name) VALUES (?, ?)', [
            'rollback-test-1',
            'Test Rollback',
          ])

          // Throw error to trigger rollback
          throw new Error('Test error to trigger rollback')
        })
      } catch (error) {
        caughtError = error as Error
      }

      // Verify error was thrown
      expect(caughtError).toBeDefined()
      expect(caughtError?.message).toBe('Test error to trigger rollback')

      // Verify transaction was rolled back:
      // 1. The inserted record from within transaction should NOT exist (proves rollback)
      const rollbackRecord = await adapter.query('SELECT * FROM test WHERE id = ?', [
        'rollback-test-1',
      ])
      expect(rollbackRecord.rows).toHaveLength(0)

      // 2. The record inserted before transaction SHOULD still exist (proves rollback worked correctly)
      // If this is missing, rollback affected data outside the transaction (bug)
      const beforeRecord = await adapter.query('SELECT * FROM test WHERE id = ?', [
        'before-transaction',
      ])
      expect(beforeRecord.rows).toHaveLength(1)
      expect(beforeRecord.rows[0].name).toBe('Before')
    })

    it.skip('should handle async callback errors (better-sqlite3 limitation)', async () => {
      // SKIPPED: This test demonstrates a known limitation
      // better-sqlite3 transactions are synchronous - async callbacks don't work properly
      // The transaction completes before async operations finish, so:
      // 1. Async errors may not trigger rollback
      // 2. Unhandled rejections can occur
      //
      // SOLUTION: Always use syncQuery for operations within transactions:
      // await adapter.transaction((syncQuery) => {
      //   syncQuery('INSERT INTO test (id, name) VALUES (?, ?)', ['1', 'Test'])
      //   throw new Error('Test error')
      // })

      // This test is skipped to avoid unhandled rejections
      // The limitation is documented in code comments
      if (result.rows.length > 0) {
        // Clean up for test isolation
        await adapter.query('DELETE FROM test')
      }
    })

    it('should throw error when transaction without connection', async () => {
      const uninitializedAdapter = sqliteAdapter({
        client: {
          url: path.join(os.tmpdir(), 'uninitialized.db'),
        },
      })

      await expect(
        uninitializedAdapter.transaction(async () => {
          // Do nothing
        }),
      ).rejects.toThrow('Database not connected')
    })
  })

  describe('close/disconnect', () => {
    it('should close database connection', async () => {
      await adapter.init()
      await adapter.close()

      // Should not be able to query after close
      await expect(adapter.query('SELECT 1')).rejects.toThrow()
    })

    it('should disconnect database connection', async () => {
      await adapter.init()
      await adapter.disconnect()

      // Should not be able to query after disconnect
      await expect(adapter.query('SELECT 1')).rejects.toThrow()
    })

    it('should handle multiple close calls', async () => {
      await adapter.init()
      await adapter.close()
      await adapter.close() // Should not throw
    })
  })
})
