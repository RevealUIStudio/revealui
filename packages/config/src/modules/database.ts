/**
 * @revealui/config - Database Configuration Module
 */

import { resolveDatabaseUrl } from '../database-url.js';
import type { EnvConfig } from '../schema.js';

export interface DatabaseConfig {
  url: string;
  connectionString: string;
}

export function getDatabaseConfig(env: EnvConfig): DatabaseConfig {
  // Same decision as every other runtime caller. Empty when nothing is set,
  // so existing config consumers keep a string.
  const url = resolveDatabaseUrl(env) ?? '';

  return {
    url,
    connectionString: url,
  };
}
