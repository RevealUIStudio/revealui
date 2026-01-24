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
        // CRITICAL: For Supabase transaction pooling (port 6543), we use pg library
        // Transaction pooling works fine with pg - no special configuration needed
        // Reference: https://supabase.com/docs/guides/database/connecting-to-postgres
        const isTransactionPooling = connectionString.includes(':6543')

        if (isTransactionPooling) {
          // For transaction pooling: Use pg library with parameterized queries
          // pg supports $1, $2 style parameters without prepared statements
          const { Pool } = await import('pg')
          const pool = new Pool({
            connectionString,
            ssl: connectionString.includes('sslmode=require')
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
