/**
 * @revealui/config - Database Configuration Module
 */

import type { EnvConfig } from '../schema'

export interface DatabaseConfig {
  url: string
  connectionString: string
}

export function getDatabaseConfig(env: EnvConfig): DatabaseConfig {
  const url = env.POSTGRES_URL || env.SUPABASE_DATABASE_URI || ''

  return {
    url,
    connectionString: url,
  }
}
