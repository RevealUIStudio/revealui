// Re-export database adapters and types
export { sqliteAdapter } from './sqlite'
export { postgresAdapter } from './postgres'
export { universalPostgresAdapter } from './universal-postgres'
export type { UniversalPostgresAdapterConfig } from './universal-postgres'
export type { DatabaseResult } from '../types/index'
