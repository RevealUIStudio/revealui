// Re-export database adapters and types

export type { DatabaseResult } from '../types/index'
export { sqliteAdapter } from './sqlite'
export type { UniversalPostgresAdapterConfig } from './universal-postgres'
export { universalPostgresAdapter } from './universal-postgres'
