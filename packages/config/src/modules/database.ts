/**
 * @revealui/config - Database Configuration Module
 */

import type { EnvConfig } from '../schema.js';

export interface DatabaseConfig {
  url: string;
  connectionString: string;
}

export function getDatabaseConfig(env: EnvConfig): DatabaseConfig {
  // Accept POSTGRES_URL or DATABASE_URL (as fallback)
  const url = env.POSTGRES_URL || env.DATABASE_URL || '';

  return {
    url,
    connectionString: url,
  };
}
