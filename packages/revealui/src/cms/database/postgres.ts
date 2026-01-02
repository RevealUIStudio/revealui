import { sql, db as vercelDb } from '@vercel/postgres'
import type { DatabaseAdapter, DatabaseResult, RevealDocument } from '../types/index'

export interface PostgresAdapterConfig {
  pool: {
    connectionString: string
  }
}

/**
 * Creates a Postgres database adapter for Vercel Postgres.
 *
 * NOTE: The config parameter is currently ignored. This adapter uses
 * @vercel/postgres which reads from the POSTGRES_URL environment variable.
 * The config interface exists for API compatibility with other adapters.
 */
export function postgresAdapter(_config: PostgresAdapterConfig): DatabaseAdapter {
  return {
    async connect(): Promise<void> {
      // Test connection - Vercel Postgres manages connections automatically
      try {
        await sql`SELECT 1`
      } catch (error) {
        console.error('Failed to connect to Postgres:', error)
        throw error
      }
    },

    async disconnect(): Promise<void> {
      // Connection is managed by @vercel/postgres
      // No explicit disconnect needed
    },

    async query(queryString: string, values: unknown[] = []): Promise<DatabaseResult> {
      try {
        // Use the db client for parameterized queries
        const client = await vercelDb.connect()
        try {
          const result = await client.query(queryString, values)
          return {
            rows: result.rows as RevealDocument[],
            rowCount: result.rowCount ?? 0,
          }
        } finally {
          client.release()
        }
      } catch (error) {
        console.error('Database query error:', error)
        throw error
      }
    },
  }
}
