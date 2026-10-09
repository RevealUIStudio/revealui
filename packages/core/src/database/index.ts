// Re-export database adapters and types (PostgreSQL/PGlite only)

export type { DatabaseResult } from '../types/index.js';
export type {
  SharedPostgresTransactionContext,
  UniversalPostgresAdapterConfig,
} from './universal-postgres.js';
export { universalPostgresAdapter } from './universal-postgres.js';
