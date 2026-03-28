/**
 * Database Contract Bridge
 *
 * Bridges Database types (from @revealui/db) with Contracts (from @revealui/contracts).
 * Provides type-safe conversion utilities between database entities and contract-validated entities.
 *
 * This enables:
 * - Type-safe conversion from Database types to Contract types
 * - Runtime validation of database data using Contracts
 * - Ensuring type safety across the DB -> ORM -> Contracts -> RevealUI layers
 *
 * @module @revealui/contracts/database
 */

import type { Contract } from '../foundation/contract.js';

/**
 * Generic Database type structure
 * Matches the structure of @revealui/db/types Database type
 * Used to avoid circular dependency between @revealui/contracts and @revealui/db
 *
 * @template T - The database tables structure
 */
export type Database<
  T extends {
    public: {
      Tables: Record<
        string,
        {
          Row: unknown;
          Insert: unknown;
          Update: unknown;
        }
      >;
    };
  } = {
    public: {
      Tables: Record<
        string,
        {
          Row: unknown;
          Insert: unknown;
          Update: unknown;
        }
      >;
    };
  },
> = T;

/**
 * Convert a database row to a contract-validated entity
 *
 * @template T - The contract type
 * @param contract - The contract to validate against
 * @param dbRow - The database row data
 * @returns Validated entity matching the contract
 * @throws If validation fails
 *
 * @example
 * ```typescript
 * import { UserSchema } from '@revealui/contracts'
 * import type { Database } from '@revealui/db/types' // Or use Database from this module
 *
 * const dbUser: Database['public']['Tables']['users']['Row'] = await db.query.users.findFirst()
 * const validatedUser = dbRowToContract(UserSchema, dbUser)
 * // validatedUser is now validated and typed according to UserSchema
 * ```
 */
export function dbRowToContract<T>(contract: Contract<T>, dbRow: unknown): T {
  return contract.parse(dbRow);
}

/**
 * Safely convert a database row to a contract-validated entity
 *
 * Returns a result object instead of throwing on validation failure.
 *
 * @template T - The contract type
 * @param contract - The contract to validate against
 * @param dbRow - The database row data
 * @returns Validation result with typed data or errors
 *
 * @example
 * ```typescript
 * const result = safeDbRowToContract(UserSchema, dbUser)
 * if (result.success) {
 *   // result.data is fully typed and validated
 *   console.log(result.data.email)
 * } else {
 *   // Handle validation errors
 *   console.error(result.errors)
 * }
 * ```
 */
export function safeDbRowToContract<T>(
  contract: Contract<T>,
  dbRow: unknown,
): ReturnType<typeof contract.validate> {
  return contract.validate(dbRow);
}

/**
 * Type guard to check if database row matches a contract
 *
 * @template T - The contract type
 * @param contract - The contract to check against
 * @param dbRow - The database row to check
 * @returns True if the row matches the contract
 */
export function isDbRowMatchingContract<T>(contract: Contract<T>, dbRow: unknown): dbRow is T {
  return contract.isType(dbRow);
}

/**
 * Extract table name from Database type
 *
 * Utility type to extract table names from the Database type structure.
 */
export type TableName<T extends Database> = keyof T['public']['Tables'];

/**
 * Extract row type for a specific table
 *
 * @template T - The Database type
 * @template N - The table name
 */
export type TableRowType<
  T extends Database,
  N extends TableName<T>,
> = T['public']['Tables'][N] extends {
  Row: infer R;
}
  ? R
  : never;

/**
 * Extract insert type for a specific table
 *
 * @template T - The Database type
 * @template N - The table name
 */
export type TableInsertType<
  T extends Database,
  N extends TableName<T>,
> = T['public']['Tables'][N] extends {
  Insert: infer I;
}
  ? I
  : never;

/**
 * Extract update type for a specific table
 *
 * @template T - The Database type
 * @template N - The table name
 */
export type TableUpdateType<
  T extends Database,
  N extends TableName<T>,
> = T['public']['Tables'][N] extends {
  Update: infer U;
}
  ? U
  : never;

/**
 * Database Contract Registry
 *
 * Maps table names to their corresponding contracts.
 * This enables automatic validation when converting database rows to contract types.
 */
export class DatabaseContractRegistry {
  private contracts = new Map<string, Contract<unknown>>();

  /**
   * Register a contract for a table
   *
   * @param tableName - The database table name
   * @param contract - The contract to use for validation
   */
  register<T>(tableName: string, contract: Contract<T>): void {
    this.contracts.set(tableName, contract as Contract<unknown>);
  }

  /**
   * Get a contract for a table
   *
   * @param tableName - The database table name
   * @returns The contract if registered, undefined otherwise
   */
  get<T>(tableName: string): Contract<T> | undefined {
    return this.contracts.get(tableName) as Contract<T> | undefined;
  }

  /**
   * Validate a database row using its registered contract
   *
   * @param tableName - The database table name
   * @param dbRow - The database row to validate
   * @returns Validation result
   */
  validateRow(tableName: string, dbRow: unknown): ReturnType<Contract<unknown>['validate']> | null {
    const contract = this.contracts.get(tableName);
    if (!contract) {
      return null;
    }
    return contract.validate(dbRow);
  }
}

/**
 * Global database contract registry instance
 */
export const databaseContractRegistry = new DatabaseContractRegistry();
