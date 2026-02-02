/**
 * Universal PostgreSQL Adapter for RevealUI CMS
 *
 * Supports multiple PostgreSQL providers:
 * - Neon Database (https://neon.tech)
 * - Supabase (https://supabase.com)
 * - Vercel Postgres (https://vercel.com/storage/postgres)
 *
 * Automatically detects the provider based on connection string or environment.
 */

import type { Field } from '@revealui/contracts/cms'
import { defaultLogger } from '../instance/logger.js'
import type { DatabaseAdapter, DatabaseResult, RevealDocument } from '../types/index.js'

export interface UniversalPostgresAdapterConfig {
  /**
   * Connection string for the database
   * Examples:
   * - Neon: postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
   * - Supabase: postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
   * - Vercel: postgres://user:pass@host:5432/dbname
   */
  connectionString?: string
  /**
   * Environment variable name for connection string
   * Defaults to checking: DATABASE_URL, POSTGRES_URL, SUPABASE_DATABASE_URI
   */
  envVar?: string
  /**
   * Force a specific provider (optional, auto-detected if not provided)
   */
  provider?: 'neon' | 'supabase' | 'electric'
}

/**
 * Global singleton PGlite instance for electric provider
 * This ensures tables and data persist across all queries and tests
 */
let globalPGliteInstance: Awaited<ReturnType<typeof import('@electric-sql/pglite').PGlite>> | null = null

/**
 * Global table creation promises for PGlite
 * Shared across all adapter instances to ensure tables are created once
 */
const globalPendingTableCreations: Promise<void>[] = []

/**
 * Track which tables have been created to avoid recreating them
 */
const globalCreatedTables = new Set<string>()

/**
 * Detects the PostgreSQL provider from connection string
 */
function detectProvider(connectionString: string): 'neon' | 'supabase' | 'electric' | 'generic' {
  const url = connectionString.toLowerCase()

  if (url.includes('.neon.tech') || url.includes('neon.tech')) {
    return 'neon'
  }

  if (url.includes('.supabase.co') || url.includes('supabase')) {
    return 'supabase'
  }

  if (url.includes('electric') || process.env.ELECTRIC_ENV) {
    return 'electric'
  }

  return 'generic'
}

/**
 * Creates a universal PostgreSQL adapter that works with Neon, Supabase, and Electric Postgres
 */
export function universalPostgresAdapter(
  config: UniversalPostgresAdapterConfig = {},
): DatabaseAdapter {
  let queryFn: (queryString: string, values: unknown[]) => Promise<DatabaseResult>
  let provider: 'neon' | 'supabase' | 'electric' | 'generic' = 'generic'

  const initializeConnection = async (): Promise<void> => {
    // Allow explicit electric provider without a connection string (PGlite local)
    let connectionString: string | undefined

    if (config.provider === 'electric') {
      provider = 'electric'
    } else {
      // Get connection string from config or environment
      connectionString =
        config.connectionString ||
        process.env[config.envVar || 'DATABASE_URL'] ||
        process.env.POSTGRES_URL ||
        process.env.SUPABASE_DATABASE_URI ||
        process.env.DATABASE_URL

      if (!connectionString) {
        throw new Error(
          'Database connection string not found. Set DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI environment variable.',
        )
      }

      // Detect provider if not explicitly set
      provider = config.provider || detectProvider(connectionString)
    }

    // Initialize provider-specific query function
    // Note: connectionString is guaranteed defined for non-electric providers (throws at line 81 if undefined)
    switch (provider) {
      case 'neon': {
        // Use pg library for Neon (more compatible with parameterized queries)
        // Neon serverless has limitations with $1, $2 style parameters
        // Using pg ensures full PostgreSQL compatibility
        const neonConnectionString = connectionString!

        queryFn = async (queryString: string, values: unknown[] = []) => {
          try {
            // Use pg library for best compatibility with parameterized queries
            const { Pool } = await import('pg')
            const pool = new Pool({
              connectionString: neonConnectionString,
              ssl: { rejectUnauthorized: false },
            })

            const client = await pool.connect()
            try {
              const result = await client.query(queryString, values)
              return {
                rows: result.rows as RevealDocument[],
                rowCount: result.rowCount || 0,
              }
            } finally {
              client.release()
            }
          } catch (error) {
            defaultLogger.error('Neon database query error:', error)
            throw error
          }
        }
        break
      }

      case 'supabase': {
        // CRITICAL: For Supabase transaction pooling (port 6543), we use pg library
        // Transaction pooling works fine with pg - no special configuration needed
        // Reference: https://supabase.com/docs/guides/database/connecting-to-postgres
        const supabaseConnectionString = connectionString!
        const isTransactionPooling = supabaseConnectionString.includes(':6543')

        if (isTransactionPooling) {
          // For transaction pooling: Use pg library with parameterized queries
          // pg supports $1, $2 style parameters without prepared statements
          const { Pool } = await import('pg')
          const pool = new Pool({
            connectionString: supabaseConnectionString,
            ssl: supabaseConnectionString.includes('sslmode=require')
              ? { rejectUnauthorized: false }
              : false,
          })

          queryFn = async (queryString: string, values: unknown[] = []) => {
            const client = await pool.connect()
            try {
              const result = await client.query(queryString, values)
              return {
                rows: result.rows as RevealDocument[],
                rowCount: result.rowCount || 0,
              }
            } finally {
              client.release()
            }
          }
        } else {
          // Use pg library for session pooling or direct connections (port 5432)
          const { Pool } = await import('pg')
          const pool = new Pool({
            connectionString: supabaseConnectionString,
            ssl: supabaseConnectionString.includes('sslmode=require')
              ? { rejectUnauthorized: false }
              : undefined,
          })

          queryFn = async (queryString: string, values: unknown[] = []) => {
            try {
              const client = await pool.connect()
              try {
                const result = await client.query(queryString, values)
                return {
                  rows: result.rows as RevealDocument[],
                  rowCount: result.rowCount || 0,
                }
              } finally {
                client.release()
              }
            } catch (error) {
              defaultLogger.error('Supabase database query error:', error)
              throw error
            }
          }
        }
        break
      }

      case 'electric': {
        // Use global singleton PGlite instance to ensure tables persist
        // across all queries, tests, and RevealUI instances
        if (!globalPGliteInstance) {
          const { PGlite } = await import('@electric-sql/pglite')
          globalPGliteInstance = new PGlite()
        }

        const db = globalPGliteInstance

        queryFn = async (queryString: string, values: unknown[] = []) => {
          const result = await db.query(queryString, values)
          return {
            rows: result.rows as RevealDocument[],
            rowCount: (result as { rowCount?: number }).rowCount || 0,
          }
        }
        break
      }

      default: {
        // Generic PostgreSQL using pg (node-postgres)
        const genericConnectionString = connectionString!
        const { Pool } = await import('pg')
        const pool = new Pool({
          connectionString: genericConnectionString,
          ssl: genericConnectionString.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : undefined,
        })

        queryFn = async (queryString: string, values: unknown[] = []) => {
          try {
            const client = await pool.connect()
            try {
              const result = await client.query(queryString, values)
              return {
                rows: result.rows as RevealDocument[],
                rowCount: result.rowCount || 0,
              }
            } finally {
              client.release()
            }
          } catch (error) {
            defaultLogger.error('PostgreSQL query error:', error)
            throw error
          }
        }
        break
      }
    }
  }

  let initialized = false

  return {
    async init(): Promise<void> {
      // Initialize connection for PGlite
      if (!initialized) {
        await initializeConnection()
        initialized = true
      }
    },

    async connect(): Promise<void> {
      if (!initialized) {
        await initializeConnection()
        initialized = true
      }

      // Wait for all pending table creation promises to complete
      if (globalPendingTableCreations.length > 0) {
        try {
          await Promise.all(globalPendingTableCreations)
          // Clear promises after successful execution
          globalPendingTableCreations.length = 0
        } catch (error) {
          defaultLogger.error('Failed to create tables:', error)
          throw error
        }
      }

      // Test connection
      try {
        await queryFn('SELECT 1', [])
      } catch (error) {
        defaultLogger.error(`Failed to connect to ${provider} database:`, error)
        throw error
      }
    },

    async disconnect(): Promise<void> {
      // Connection pooling is handled by the provider libraries
      // No explicit disconnect needed for most providers
      if (provider === 'supabase' || provider === 'generic') {
        // pg Pool cleanup would go here if needed
        // Most providers handle connection cleanup automatically
      }
      await Promise.resolve()
    },

    async query(queryString: string, values: unknown[] = []): Promise<DatabaseResult> {
      if (!initialized) {
        await initializeConnection()
        initialized = true
      }

      // Wait for any pending table creations before executing queries
      if (globalPendingTableCreations.length > 0) {
        try {
          await Promise.all(globalPendingTableCreations)
          // Clear promises after successful execution
          globalPendingTableCreations.length = 0
        } catch (error) {
          defaultLogger.error('Failed to create tables before query:', error)
          throw error
        }
      }

      return queryFn(queryString, values)
    },

    // Create table schema for PGlite provider
    // For other providers, tables should be created via migrations
    createTable: provider === 'electric' ? (tableName: string, fields: Field[]) => {
      // Skip if table was already created
      if (globalCreatedTables.has(tableName)) {
        return
      }

      // Mark as created to prevent duplicates
      globalCreatedTables.add(tableName)

      // Build CREATE TABLE SQL statement
      const columns: string[] = [
        'id SERIAL PRIMARY KEY',
        'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ]

      // Add fields from collection definition
      for (const field of fields) {
        if ('name' in field && field.name) {
          let columnType = 'TEXT'

          // Map field types to PostgreSQL types
          if ('type' in field) {
            switch (field.type) {
              case 'number':
                columnType = 'NUMERIC'
                break
              case 'checkbox':
                columnType = 'BOOLEAN'
                break
              case 'date':
                columnType = 'TIMESTAMP'
                break
              case 'json':
              case 'richText':
              case 'array':
              case 'blocks':
                columnType = 'JSONB'
                break
              case 'relationship':
                columnType = 'INTEGER' // Foreign key
                break
              default:
                columnType = 'TEXT'
            }
          }

          const required = 'required' in field && field.required ? 'NOT NULL' : ''
          columns.push(`"${field.name}" ${columnType} ${required}`.trim())
        }
      }

      const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(', ')})`

      // Execute CREATE TABLE and store promise for awaiting before queries
      // Don't catch errors here - let them propagate when the promise is awaited
      const createPromise = (async () => {
        try {
          await queryFn(createTableSQL, [])
        } catch (error) {
          // Remove from created set on failure so it can be retried
          globalCreatedTables.delete(tableName)
          defaultLogger.error(`Failed to create table ${tableName}:`, error)
          defaultLogger.error('SQL:', createTableSQL)
          throw error
        }
      })()

      globalPendingTableCreations.push(createPromise)
    } : undefined,

    // Create global table schema for PGlite provider
    createGlobalTable: provider === 'electric' ? (globalSlug: string, fields: Field[]) => {
      const tableName = `global_${globalSlug}`

      // Skip if table was already created
      if (globalCreatedTables.has(tableName)) {
        return
      }

      // Mark as created to prevent duplicates
      globalCreatedTables.add(tableName)

      // Build CREATE TABLE SQL statement for global
      const columns: string[] = [
        'id SERIAL PRIMARY KEY',
        'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      ]

      // Add fields from global definition
      for (const field of fields) {
        if ('name' in field && field.name) {
          let columnType = 'TEXT'

          // Map field types to PostgreSQL types
          if ('type' in field) {
            switch (field.type) {
              case 'number':
                columnType = 'NUMERIC'
                break
              case 'checkbox':
                columnType = 'BOOLEAN'
                break
              case 'date':
                columnType = 'TIMESTAMP'
                break
              case 'json':
              case 'richText':
              case 'array':
              case 'blocks':
                columnType = 'JSONB'
                break
              default:
                columnType = 'TEXT'
            }
          }

          const required = 'required' in field && field.required ? 'NOT NULL' : ''
          columns.push(`"${field.name}" ${columnType} ${required}`.trim())
        }
      }

      const createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.join(', ')})`

      // Execute CREATE TABLE and store promise for awaiting before queries
      // Don't catch errors here - let them propagate when the promise is awaited
      const createPromise = (async () => {
        try {
          await queryFn(createTableSQL, [])
        } catch (error) {
          // Remove from created set on failure so it can be retried
          globalCreatedTables.delete(tableName)
          defaultLogger.error(`Failed to create global table ${tableName}:`, error)
          defaultLogger.error('SQL:', createTableSQL)
          throw error
        }
      })()

      globalPendingTableCreations.push(createPromise)
    } : undefined,
  }
}
  }
}
  }
}
  }
}

/**
 * Clear the global PGlite instance and state (useful for test cleanup)
 * Only affects electric provider
 */
export function clearGlobalPGlite(): void {
  globalPGliteInstance = null
  globalPendingTableCreations.length = 0
  globalCreatedTables.clear()
}

// Export as default for convenience
export default universalPostgresAdapter
