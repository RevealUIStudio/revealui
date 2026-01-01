import { sql } from '@vercel/postgres';
import type { DatabaseAdapter, DatabaseResult } from '../types/index';

export interface PostgresAdapterConfig {
  pool: {
    connectionString: string;
  };
}

export function postgresAdapter(config: PostgresAdapterConfig): DatabaseAdapter {
  return {
    async init(): Promise<void> {
      // Test connection
      await sql`SELECT 1`;
    },

    async connect(): Promise<void> {
      // Connection is managed by @vercel/postgres
    },

    async close(): Promise<void> {
      // Connection is managed by @vercel/postgres
    },

    async query(query: string, values: unknown[] = []): Promise<DatabaseResult> {
      try {
        const result = await sql.unsafe(query, values);
        return {
          rows: result.rows as RevealDocument[],
          rowCount: result.rowCount
        };
      } catch (error) {
        console.error('Database query error:', error);
        throw error;
      }
    },

    async transaction(callback: () => Promise<void>): Promise<void> {
      // Vercel Postgres handles transactions automatically
      await callback();
    },
  };
}

