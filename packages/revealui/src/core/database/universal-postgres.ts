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
  provider?: 'neon' | 'supabase' | 'vercel'
}

/**
 * Detects the PostgreSQL provider from connection string
 */
function detectProvider(connectionString: string): 'neon' | 'supabase' | 'vercel' | 'generic' {
  const url = connectionString.toLowerCase()

  if (url.includes('.neon.tech') || url.includes('neon.tech')) {
    return 'neon'
  }

  if (url.includes('.supabase.co') || url.includes('supabase')) {
    return 'supabase'
  }

  if (url.includes('vercel') || process.env.VERCEL_ENV) {
    return 'vercel'
  }

  return 'generic'
}

/**
 * Creates a universal PostgreSQL adapter that works with Neon, Supabase, and Vercel Postgres
 */
export function universalPostgresAdapter(
  config: UniversalPostgresAdapterConfig = {},
): DatabaseAdapter {
  let queryFn: (queryString: string, values: unknown[]) => Promise<DatabaseResult>
  let provider: 'neon' | 'supabase' | 'vercel' | 'generic' = 'generic'

  const initializeConnection = async (): Promise<void> => {
    // Get connection string from config or environment
    const connectionString =
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

    // Initialize provider-specific query function
    switch (provider) {
      case 'neon': {
        // Use pg library for Neon (more compatible with parameterized queries)
        // Neon serverless has limitations with $1, $2 style parameters
        // Using pg ensures full PostgreSQL compatibility

        queryFn = async (queryString: string, values: unknown[] = []) => {
          try {
            // Use pg library for best compatibility with parameterized queries
            const { Pool } = await import('pg')
            const pool = new Pool({
              connectionString,
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
        // CRITICAL: For Supabase transaction pooling (port 6543), prepared statements must be disabled
        // Transaction pooling mode doesn't support prepared statements
        // Reference: https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-drizzle
        const isTransactionPooling = connectionString.includes(':6543')

        if (isTransactionPooling) {
          // For transaction pooling: Use postgres-js with prepare: false
          // This is the recommended approach per Supabase documentation
          const postgres = (await import('postgres')).default
          const sql = postgres(connectionString, {
            prepare: false, // REQUIRED for transaction pooling
            ssl: connectionString.includes('sslmode=require') ? 'require' : undefined,
          })

          queryFn = async (queryString: string, values: unknown[] = []) => {
            try {
              // postgres-js with prepare: false doesn't support $1, $2 style parameters
              // We need to use template literal syntax or manually substitute parameters
              // For safety, we'll use postgres-js template literal which handles escaping
              let result
              if (values.length > 0) {
                // Convert $1, $2 style to template literal for postgres-js
                // This is safe because postgres-js template literals handle SQL injection
                const templateParts: unknown[] = []
                const _currentIndex = 0
                const _paramIndex = 0

                // Replace $1, $2, etc. with template literal syntax
                const parts = queryString.split(/\$(\d+)/)
                for (let i = 0; i < parts.length; i++) {
                  if (i % 2 === 0) {
                    // Regular SQL text
                    templateParts.push(parts[i])
                  } else {
                    // Parameter placeholder
                    const paramNum = parseInt(parts[i], 10)
                    if (paramNum > 0 && paramNum <= values.length) {
                      templateParts.push(values[paramNum - 1])
                    }
                  }
                }

                // Use postgres-js template literal
                result = await (sql as any)(templateParts as any)
              } else {
                result = await sql.unsafe(queryString)
              }
              // postgres-js returns array of objects directly
              return {
                rows: Array.isArray(result) ? (result as RevealDocument[]) : [],
                rowCount: Array.isArray(result) ? result.length : 0,
              }
            } catch (error) {
              defaultLogger.error('Supabase (transaction pooling) query error:', error)
              throw error
            }
          }
        } else {
          // Use pg library for session pooling or direct connections (port 5432)
          const { Pool } = await import('pg')
          const pool = new Pool({
            connectionString,
            ssl: connectionString.includes('sslmode=require')
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

      case 'vercel': {
        // Use @vercel/postgres for Vercel Postgres
        const { db } = await import('@vercel/postgres')

        queryFn = async (queryString: string, values: unknown[] = []) => {
          try {
            const client = await db.connect()
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
            defaultLogger.error('Vercel Postgres query error:', error)
            throw error
          }
        }
        break
      }

      default: {
        // Generic PostgreSQL using pg (node-postgres)
        const { Pool } = await import('pg')
        const pool = new Pool({
          connectionString,
          ssl: connectionString.includes('sslmode=require')
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
    async connect(): Promise<void> {
      if (!initialized) {
        await initializeConnection()
        initialized = true
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
    },

    async query(queryString: string, values: unknown[] = []): Promise<DatabaseResult> {
      if (!initialized) {
        await initializeConnection()
        initialized = true
      }

      return queryFn(queryString, values)
    },
  }
}

// Export as default for convenience
export default universalPostgresAdapter
