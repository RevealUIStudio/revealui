// Re-export database adapters and types
export { sqliteAdapter } from './sqlite';
export { postgresAdapter, postgresAdapter as vercelPostgresAdapter } from './postgres';
export type { DatabaseResult } from '../types/index';
