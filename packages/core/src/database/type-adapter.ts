/**
 * Database Type Adapter
 *
 * Adapter between Database types (from @revealui/contracts) and RevealUI types.
 * Ensures type safety across the database -> ORM -> Contracts -> RevealUI layers.
 *
 * @module revealui/core/database/type-adapter
 */

import type { Contract } from '@revealui/contracts/foundation';

/**
 * Convert database row to RevealUI document type
 *
 * @template TDoc - The RevealUI document type
 * @template TDbRow - The database row type
 * @param dbRow - The database row
 * @returns RevealUI document
 */
export function dbRowToRevealUIDoc<TDoc, TDbRow>(dbRow: TDbRow): TDoc {
  return dbRow as unknown as TDoc;
}

/**
 * Convert RevealUI document to database insert type
 *
 * @template TDoc - The RevealUI document type
 * @template TInsert - The database insert type
 * @param doc - The RevealUI document
 * @returns Database insert type
 */
export function revealUIDocToDbInsert<TDoc, TInsert>(doc: TDoc): TInsert {
  return doc as unknown as TInsert;
}

/**
 * Convert database row to contract-validated entity
 *
 * Uses the contract system to validate database data.
 *
 * @template TContract - The contract type
 * @template TDbRow - The database row type
 * @param contract - The contract to validate against
 * @param dbRow - The database row
 * @returns Contract-validated entity
 */
export function dbRowToContract<TContract, TDbRow>(
  contract: Contract<TContract>,
  dbRow: TDbRow,
): TContract {
  return contract.parse(dbRow);
}

/**
 * Type-safe table-to-contract mapping
 *
 * Maps database table names to their corresponding contracts for automatic validation.
 */
type DatabaseLike = {
  public: {
    Tables: Record<string, { Row: unknown; Insert: unknown; Update: unknown }>;
  };
};

export type TableContractMapping<T extends DatabaseLike> = {
  [K in keyof T['public']['Tables']]?: T['public']['Tables'][K] extends {
    Row: infer R;
  }
    ? Contract<R>
    : never;
};

/**
 * Create a type-safe adapter for a specific table
 *
 * @template T - The Database type
 * @template N - The table name
 * @param contract - Optional contract for validation
 * @returns Adapter functions for the table
 *
 * @example
 * ```typescript
 * import type { Database } from '@revealui/contracts/generated'
 * import { UserSchema } from '@revealui/contracts/entities'
 *
 * const userAdapter = createTableAdapter<Database, 'users'>(UserSchema)
 *
 * const dbUser = await db.query.users.findFirst()
 * const validatedUser = userAdapter.toContract(dbUser)
 * ```
 */
export function createTableAdapter<T extends DatabaseLike, N extends keyof T['public']['Tables']>(
  contract?: T['public']['Tables'][N] extends {
    Row: infer R;
  }
    ? Contract<R>
    : never,
) {
  type TableType = T['public']['Tables'][N];
  type RowType = TableType extends {
    Row: infer R;
  }
    ? R
    : never;
  type InsertType = TableType extends {
    Insert: infer I;
  }
    ? I
    : never;
  type UpdateType = TableType extends {
    Update: infer U;
  }
    ? U
    : never;

  return {
    /**
     * Convert database row to contract-validated entity
     *
     * @note Type assertion is necessary here because TypeScript cannot narrow
     * conditional types in runtime checks. The conditional type signature ensures
     * that when `contract` is defined, it is always `Contract<RowType>`, but
     * TypeScript's control flow analysis doesn't recognize this at runtime.
     * The assertion is safe because the type system guarantees the contract type.
     */
    toContract(dbRow: RowType): RowType {
      if (contract) {
        // TypeScript's conditional type ensures contract is Contract<RowType> when defined,
        // but runtime narrowing doesn't preserve this. The assertion is type-safe.
        const validated = (contract as Contract<RowType>).parse(dbRow);
        return validated;
      }
      return dbRow;
    },

    /**
     * Convert contract-validated entity to database insert
     */
    toInsert(data: RowType): InsertType {
      return data as unknown as InsertType;
    },

    /**
     * Convert contract-validated entity to database update
     */
    toUpdate(data: Partial<RowType>): UpdateType {
      return data as unknown as UpdateType;
    },
  };
}
