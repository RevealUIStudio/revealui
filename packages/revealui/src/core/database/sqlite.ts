import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { defaultLogger } from '../instance/logger'
import type { DatabaseAdapter, DatabaseResult, Field, RevealDocument } from '../types/index'

export interface SQLiteAdapterConfig {
  client: {
    url: string
  }
  migrationDir?: string
  push?: boolean
}

export function sqliteAdapter(
  config: SQLiteAdapterConfig,
): DatabaseAdapter & { __db?: Database.Database | null } {
  let db: Database.Database | null = null

  // Schema management
  const createdTables = new Set<string>() // Track which tables have been created
  const createTable = (tableName: string, fields: Field[]) => {
    if (!db) return

    // Only drop and recreate table if it doesn't exist or in test mode
    // In test mode, we want fresh schemas, but we should only drop once per adapter instance
    const isTestMode = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
    const tableAlreadyCreated = createdTables.has(tableName)

    if (isTestMode && !tableAlreadyCreated) {
      // Only drop on first creation in test mode
      try {
        db.exec(`DROP TABLE IF EXISTS "${tableName}"`)
      } catch {
        // Ignore errors - table might not exist
      }
    } else if (!isTestMode && !tableAlreadyCreated) {
      // In non-test mode, only drop if table doesn't exist
      // Don't drop existing tables
    }

    // Filter out 'id' field if it exists (we add it separately)
    const filteredFields = fields.filter((field) => field.name !== 'id')

    const columns = filteredFields.map((field) => {
      // Quote column names to handle reserved words and special characters
      const columnName = `"${field.name}"`
      let columnDef = columnName

      switch (field.type) {
        case 'text':
          columnDef += ' TEXT'
          break
        case 'textarea':
          columnDef += ' TEXT'
          break
        case 'number':
          columnDef += ' REAL'
          break
        case 'email':
          columnDef += ' TEXT'
          break
        case 'date':
          columnDef += ' DATETIME'
          break
        case 'checkbox':
          columnDef += ' BOOLEAN'
          break
        case 'json':
          columnDef += ' TEXT' // Store as JSON string
          break
        case 'relationship':
          // For direct FK relationships (single relationTo, no hasMany), store as FK
          if (field.relationTo && !Array.isArray(field.relationTo) && !field.hasMany) {
            columnDef += ' TEXT' // Store as foreign key (text for UUIDs)
          } else {
            columnDef += ' TEXT' // Store as JSON string for complex relations
          }
          break
        default:
          columnDef += ' TEXT'
      }

      if (field.required) {
        columnDef += ' NOT NULL'
      }

      if (field.unique) {
        columnDef += ' UNIQUE'
      }

      return columnDef
    })

    // Add standard columns
    columns.unshift('"id" TEXT PRIMARY KEY')
    columns.push('"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP')
    columns.push('"updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP')
    // Add _json column for storing JSON fields (array, group, blocks, richText, select with hasMany)
    // SQLite stores JSON as TEXT, but we can use JSON functions for querying
    columns.push('"_json" TEXT DEFAULT \'{}\'')

    // Quote table name to handle hyphens and reserved words
    const quotedTableName = `"${tableName}"`
    // Use CREATE TABLE IF NOT EXISTS if table was already created to avoid errors
    // But use CREATE TABLE on first creation (after drop in test mode)
    const createQuery = tableAlreadyCreated
      ? `CREATE TABLE IF NOT EXISTS ${quotedTableName} (${columns.join(', ')})`
      : `CREATE TABLE ${quotedTableName} (${columns.join(', ')})`
    db.exec(createQuery)
    createdTables.add(tableName) // Mark table as created to prevent future drops
  }

  const createGlobalTable = (globalSlug: string, fields: Field[]) => {
    if (!db) return

    const tableName = `global_${globalSlug}`
    // Filter out 'id' field if it exists (we add it separately)
    const filteredFields = fields.filter((field) => field.name !== 'id')

    const columns = filteredFields.map((field) => {
      // Quote column names to handle reserved words and special characters
      const columnName = `"${field.name}"`
      let columnDef = columnName

      switch (field.type) {
        case 'text':
          columnDef += ' TEXT'
          break
        case 'textarea':
          columnDef += ' TEXT'
          break
        case 'number':
          columnDef += ' REAL'
          break
        case 'email':
          columnDef += ' TEXT'
          break
        case 'date':
          columnDef += ' DATETIME'
          break
        case 'checkbox':
          columnDef += ' BOOLEAN'
          break
        case 'json':
          columnDef += ' TEXT' // Store as JSON string
          break
        case 'relationship':
          // For direct FK relationships (single relationTo, no hasMany), store as FK
          if (field.relationTo && !Array.isArray(field.relationTo) && !field.hasMany) {
            columnDef += ' TEXT' // Store as foreign key (text for UUIDs)
          } else {
            columnDef += ' TEXT' // Store as JSON string for complex relations
          }
          break
        default:
          columnDef += ' TEXT'
      }

      return columnDef
    })

    // Add standard columns
    columns.unshift('"id" TEXT PRIMARY KEY')
    columns.push('"created_at" DATETIME DEFAULT CURRENT_TIMESTAMP')
    columns.push('"updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP')
    // Add _json column for storing JSON fields (array, group, blocks, richText, select with hasMany)
    // SQLite stores JSON as TEXT, but we can use JSON functions for querying
    columns.push('"_json" TEXT DEFAULT \'{}\'')

    // Quote table name to handle hyphens and reserved words
    const quotedTableName = `"${tableName}"`
    const createQuery = `CREATE TABLE IF NOT EXISTS ${quotedTableName} (${columns.join(', ')})`

    try {
      db.exec(createQuery)
    } catch (error) {
      defaultLogger.error(`Failed to create global table ${tableName}:`, error)
    }
  }

  const adapter = {
    async init(): Promise<void> {
      // If already initialized, don't reinitialize (idempotent)
      if (db) {
        return
      }

      // Ensure the directory exists
      const dbPath = config.client.url
      const dbDir = path.dirname(dbPath)

      try {
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true })
        }
      } catch (error) {
        defaultLogger.error('Failed to create database directory:', error)
      }

      // Create database connection
      db = new Database(dbPath)

      // Enable WAL mode for better performance
      db.pragma('journal_mode = WAL')

      // Enable foreign keys
      db.pragma('foreign_keys = ON')
    },

    async connect(): Promise<void> {
      if (!db) {
        throw new Error('Database not initialized')
      }
      // Connection is already established in init
    },

    async close(): Promise<void> {
      if (db) {
        db.close()
        db = null
      }
    },

    async disconnect(): Promise<void> {
      if (db) {
        db.close()
        db = null
      }
    },

    async query(query: string, values: unknown[] = []): Promise<DatabaseResult> {
      if (!db) {
        throw new Error('Database not connected')
      }

      try {
        // Convert PostgreSQL-style placeholders ($1, $2, etc.) to SQLite placeholders (?)
        // This allows the same query generation code to work with both databases
        let sqliteQuery = query
        const placeholderMatches = query.match(/\$\d+/g)
        if (placeholderMatches) {
          // Replace $1, $2, etc. with ?
          sqliteQuery = query.replace(/\$\d+/g, '?')
        }

        // Handle PRAGMA queries specially
        // PRAGMA table_info returns multiple rows (one per column), not a single row
        if (sqliteQuery.toLowerCase().trim().startsWith('pragma')) {
          const stmt = db.prepare(sqliteQuery)
          // PRAGMA table_info returns multiple rows, use .all() not .get()
          const results = stmt.all(values) as RevealDocument[]
          return {
            rows: results,
            rowCount: results.length,
          }
        } else if (sqliteQuery.toLowerCase().trim().startsWith('select')) {
          const stmt = db.prepare(sqliteQuery)
          const rows = stmt.all(values) as RevealDocument[]
          return {
            rows,
            rowCount: rows.length,
          }
        } else {
          const stmt = db.prepare(sqliteQuery)
          stmt.run(values)
          return {
            rows: [],
            rowCount: 0,
          }
        }
      } catch (error) {
        defaultLogger.error('Database query error:', error)
        throw error
      }
    },

    async transaction(
      callback: (
        syncQuery?: (query: string, values?: unknown[]) => DatabaseResult,
      ) => void | Promise<void>,
    ): Promise<void> {
      if (!db) {
        throw new Error('Database not connected')
      }

      // better-sqlite3 transactions are synchronous, but we support async callbacks
      // For proper transactional behavior with rollback support:
      // 1. All database operations within the transaction must be synchronous
      // 2. We provide a synchronous query wrapper for use in transactions
      // 3. Errors cause automatic rollback

      // Create synchronous query wrapper for use within transactions
      const syncQuery = (query: string, values: unknown[] = []): DatabaseResult => {
        if (!db) {
          throw new Error('Database not connected')
        }

        let sqliteQuery = query
        const placeholderMatches = query.match(/\$\d+/g)
        if (placeholderMatches) {
          sqliteQuery = query.replace(/\$\d+/g, '?')
        }

        if (sqliteQuery.toLowerCase().trim().startsWith('pragma')) {
          const stmt = db.prepare(sqliteQuery)
          // For PRAGMA table_info, use .all() to get all columns
          const rows = stmt.all(values) as RevealDocument[]
          return {
            rows,
            rowCount: rows.length,
          }
        } else if (sqliteQuery.toLowerCase().trim().startsWith('select')) {
          const stmt = db.prepare(sqliteQuery)
          const rows = stmt.all(values) as RevealDocument[]
          return {
            rows,
            rowCount: rows.length,
          }
        } else {
          const stmt = db.prepare(sqliteQuery)
          stmt.run(values)
          return {
            rows: [],
            rowCount: 0,
          }
        }
      }

      // CRITICAL: Execute callback INSIDE transaction, not before!
      // Previously, we were checking if callback is async by executing it,
      // which ran the callback OUTSIDE the transaction, causing rollback to fail.
      // Now we wrap ALL callbacks in a transaction and execute them inside.

      // Create transaction wrapper - ALL callbacks execute INSIDE transaction
      // This ensures proper rollback behavior for sync callbacks
      const transactionFn = db.transaction(() => {
        // Execute callback inside transaction - this ensures all operations are transactional
        callback(syncQuery)
      })

      // Execute transaction synchronously - errors cause automatic rollback
      try {
        transactionFn()
        return Promise.resolve()
      } catch (error) {
        // Transaction was rolled back due to error - return rejected promise
        return Promise.reject(error)
      }
    },

    // Additional methods for schema management
    createTable,
    createGlobalTable,
  }

  // Expose database for testing (allows synchronous operations in transactions)
  // Use Object.defineProperty to add __db without affecting type
  // The getter must access the closure variable 'db' which is set in init()
  Object.defineProperty(adapter, '__db', {
    get() {
      // Access closure variable directly - this should work if closure is correct
      return db
    },
    enumerable: false,
    configurable: true,
  })

  // Type assertion to include __db in the return type
  return adapter as DatabaseAdapter & {
    createTable: (tableName: string, fields: Field[]) => void
    createGlobalTable: (globalSlug: string, fields: Field[]) => void
    __db?: Database.Database | null
  }
}
