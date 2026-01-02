import Database from 'better-sqlite3'
import type { DatabaseAdapter, DatabaseResult, Field, RevealDocument } from '../types/index'
import path from 'path'
import fs from 'fs'

export interface SQLiteAdapterConfig {
  client: {
    url: string
  }
  migrationDir?: string
  push?: boolean
}

export function sqliteAdapter(config: SQLiteAdapterConfig): DatabaseAdapter {
  let db: Database.Database | null = null

  // Schema management
  const createTable = (tableName: string, fields: Field[]) => {
    if (!db) return

    // In test mode, drop existing table to ensure fresh schema
    const isTestMode = process.env.NODE_ENV === 'test'
    if (isTestMode) {
      try {
        db.exec(`DROP TABLE IF EXISTS "${tableName}"`)
      } catch (error) {
        // Ignore errors - table might not exist
      }
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

    // Quote table name to handle hyphens and reserved words
    const quotedTableName = `"${tableName}"`
    const createQuery = `CREATE TABLE IF NOT EXISTS ${quotedTableName} (${columns.join(', ')})`

    try {
      db.exec(createQuery)
    } catch (error) {
      console.error(`Failed to create table ${tableName}:`, error)
    }
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

    // Quote table name to handle hyphens and reserved words
    const quotedTableName = `"${tableName}"`
    const createQuery = `CREATE TABLE IF NOT EXISTS ${quotedTableName} (${columns.join(', ')})`

    try {
      db.exec(createQuery)
    } catch (error) {
      console.error(`Failed to create global table ${tableName}:`, error)
    }
  }

  return {
    async init(): Promise<void> {
      // Ensure the directory exists
      const dbPath = config.client.url
      const dbDir = path.dirname(dbPath)

      try {
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true })
        }
      } catch (error) {
        console.error('Failed to create database directory:', error)
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

        if (sqliteQuery.toLowerCase().trim().startsWith('select')) {
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
        console.error('Database query error:', error)
        throw error
      }
    },

    async transaction(callback: () => Promise<void>): Promise<void> {
      if (!db) {
        throw new Error('Database not connected')
      }

      const transaction = db.transaction(() => {
        return callback()
      })

      return transaction()
    },

    // Additional methods for schema management
    createTable,
    createGlobalTable,
  } as DatabaseAdapter & {
    createTable: (tableName: string, fields: Field[]) => void
    createGlobalTable: (globalSlug: string, fields: Field[]) => void
  }
}
