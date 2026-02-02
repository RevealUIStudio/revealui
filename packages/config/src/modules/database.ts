/**
 * @revealui/config - Database Configuration Module
 */

import type { EnvConfig } from '../schema'

export interface DatabaseConfig {
  url: string
  connectionString: string
}

export function getDatabaseConfig(env: EnvConfig): DatabaseConfig {
  // Accept POSTGRES_URL, DATABASE_URL (as fallback), or SUPABASE_DATABASE_URI
  const url = env.POSTGRES_URL || env.DATABASE_URL || env.SUPABASE_DATABASE_URI || ''

  return {
    url,
    connectionString: url,
  }
}
