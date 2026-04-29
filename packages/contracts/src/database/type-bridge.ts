/**
 * Type Bridge Utilities
 *
 * Provides comprehensive type-safe conversion utilities between:
 * - Drizzle ORM types (from @revealui/db)
 * - Contract types (from @revealui/contracts)
 * - RevealUI types (from @revealui/core)
 *
 * This ensures type safety across all layers of the application.
 *
 * @module @revealui/contracts/core/contracts/type-bridge
 */

import type { Contract, ContractValidationResult } from '../foundation/contract.js';
import type { Database } from './types.js';

// Re-export the canonical `Database<T>` generic so existing consumers of
// `@revealui/contracts/database/type-bridge` (or anyone importing `Database`
// directly from this module) continue to work.
export type { Database };

/**
 * Convert Contract type to Drizzle insert type
 *
 * Ensures contract-validated data can be safely inserted into database.
 *
 * @template TContract - The Contract type
 * @template TInsert - The Drizzle insert type
 */
export type ContractToDrizzleInsert<TContract, TInsert> = TContract extends TInsert
  ? TInsert
  : never;

/**
 * Type-safe mapper function for converting database rows to contract types
 *
 * @template TContract - The contract type
 * @template TDbRow - The database row type
 * @param contract - The contract to validate against
 * @param mapper - Optional mapper function to transform the row before validation
 * @returns A function that converts database rows to contract-validated entities
 *
 * @example
 * ```typescript
 * const userMapper = createDbRowMapper(UserSchema, (row) => ({
 *   ...row,
 *   // Transform if needed
 * }))
 *
 * const dbUser = await db.query.users.findFirst()
 * const validatedUser = userMapper(dbUser)
 * ```
 */
export function createDbRowMapper<TContract, TDbRow = unknown>(
  contract: Contract<TContract>,
  mapper?: (row: TDbRow) => unknown,
) {
  return (row: TDbRow): TContract => {
    const data = mapper ? mapper(row) : row;
    return contract.parse(data);
  };
}

/**
 * Type-safe mapper function for converting contract types to database insert types
 *
 * @template TContract - The contract type
 * @template TInsert - The database insert type
 * @param mapper - Optional mapper function to transform the contract data before insertion
 * @returns A function that converts contract-validated entities to database insert types
 *
 * @example
 * ```typescript
 * const insertMapper = createContractToDbMapper<User, Database['public']['Tables']['users']['Insert']>(
 *   (user) => ({
 *     ...user,
 *     // Transform if needed
 *   })
 * )
 *
 * const newUser = createUser({ email: 'user@example.com', name: 'User' })
 * const dbInsert = insertMapper(newUser)
 * await db.insert(users).values(dbInsert)
 * ```
 */
export function createContractToDbMapper<TContract, TInsert = TContract>(
  mapper?: (data: TContract) => TInsert,
) {
  return (data: TContract): TInsert => {
    if (mapper) {
      return mapper(data);
    }
    return data as unknown as TInsert;
  };
}

/**
 * Batch convert database rows to contract-validated entities
 *
 * @template TContract - The contract type
 * @template TDbRow - The database row type
 * @param contract - The contract to validate against
 * @param rows - Array of database rows
 * @param mapper - Optional mapper function
 * @returns Array of validated entities
 */
export function batchDbRowsToContract<TContract, TDbRow = unknown>(
  contract: Contract<TContract>,
  rows: TDbRow[],
  mapper?: (row: TDbRow) => unknown,
): TContract[] {
  return rows.map((row) => {
    const data = mapper ? mapper(row) : row;
    return contract.parse(data);
  });
}

/**
 * Batch convert contract-validated entities to database insert types
 *
 * @template TContract - The contract type
 * @template TInsert - The database insert type
 * @param entities - Array of contract-validated entities
 * @param mapper - Optional mapper function
 * @returns Array of database insert types
 */
export function batchContractToDbInsert<TContract, TInsert = TContract>(
  entities: TContract[],
  mapper?: (data: TContract) => TInsert,
): TInsert[] {
  return entities.map((entity) => {
    if (mapper) {
      return mapper(entity);
    }
    return entity as unknown as TInsert;
  });
}

/**
 * Type guard to check if a value matches both Drizzle and Contract types
 *
 * @template TContract - The contract type
 * @template TDbRow - The database row type
 * @param contract - The contract to check against
 * @param value - The value to check
 * @returns True if value matches both types
 */
export function isDbRowAndContract<TContract, TDbRow>(
  contract: Contract<TContract>,
  value: unknown,
): value is TContract & TDbRow {
  return contract.isType(value);
}

/**
 * Extract contract type from a table name
 *
 * Utility type helper for type-safe table-to-contract mapping.
 *
 * @template T - The Database type (from @revealui/db/types or compatible structure)
 */
export type TableContractMap<T extends Database> = {
  [K in keyof T['public']['Tables']]?: T['public']['Tables'][K] extends {
    Row: infer R;
  }
    ? Contract<R>
    : never;
};

/**
 * Create a type-safe table-to-contract registry
 *
 * @template T - The Database type
 * @param map - Map of table names to contracts
 * @returns Registry with type-safe access
 *
 * @example
 * ```typescript
 * const registry = createTableContractRegistry<Database>({
 *   users: UserSchema,
 *   sites: SiteSchema,
 * })
 *
 * const user = await db.query.users.findFirst()
 * const validated = registry.validate('users', user)
 * ```
 */
export function createTableContractRegistry<T extends Database>(map: TableContractMap<T>) {
  return {
    /**
     * Validate a database row using its table's contract
     */
    validate<K extends keyof T['public']['Tables']>(
      tableName: K,
      row: T['public']['Tables'][K] extends { Row: infer R } ? R : never,
    ): T['public']['Tables'][K] extends {
      Row: infer R;
    }
      ? ContractValidationResult<R> | null
      : null {
      const contract = map[tableName];
      if (!contract) {
        return null as T['public']['Tables'][K] extends {
          Row: infer R;
        }
          ? ContractValidationResult<R> | null
          : null;
      }
      type TableType = T['public']['Tables'][K];
      type RowType = TableType extends {
        Row: infer R;
      }
        ? R
        : never;
      type ContractType = Contract<RowType>;
      return (contract as ContractType).validate(
        row as RowType,
      ) as T['public']['Tables'][K] extends {
        Row: infer R;
      }
        ? ContractValidationResult<R>
        : never;
    },

    /**
     * Get contract for a table
     */
    getContract<K extends keyof T['public']['Tables']>(
      tableName: K,
    ): T['public']['Tables'][K] extends {
      Row: infer R;
    }
      ? Contract<R> | undefined
      : undefined {
      return map[tableName] as T['public']['Tables'][K] extends {
        Row: infer R;
      }
        ? Contract<R> | undefined
        : undefined;
    },
  };
}
