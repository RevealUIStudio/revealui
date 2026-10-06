/**
 * Native PostgreSQL client and transaction types.
 *
 * `Database` in `@revealui/db/types` describes generated table contracts. These
 * aliases describe Drizzle runtime executors and are kept distinct from that
 * generated shape.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema/index.js';
import type { Database } from '../types/index.js';

export type { Database };

export type DatabaseClient = NodePgDatabase<typeof schema>;
export type DatabaseTransaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];
export type Transaction = DatabaseTransaction;

export type QueryResult<
  T extends Database,
  N extends keyof T['public']['Tables'],
> = T['public']['Tables'][N] extends { Row: infer Row } ? Row : never;

export type QueryResults<T extends Database, N extends Array<keyof T['public']['Tables']>> = {
  [K in N[number]]: T['public']['Tables'][K] extends { Row: infer Row } ? Row : never;
};

export type TableRelationships<
  T extends Database,
  N extends keyof T['public']['Tables'],
> = T['public']['Tables'][N] extends { Relationships: infer Relationships } ? Relationships : never;

export type RelatedTables<
  T extends Database,
  N extends keyof T['public']['Tables'],
> = T['public']['Tables'][N] extends {
  Relationships: ReadonlyArray<{ referencedRelation: infer Relation }>;
}
  ? Relation extends keyof T['public']['Tables']
    ? Relation
    : never
  : never;
