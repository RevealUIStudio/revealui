import type { RevealFindOptions, RevealWhere } from '../types/index.js';
/**
 * Query Builder Utilities
 *
 * Handles building WHERE clauses from RevealWhere query objects.
 * Uses PostgreSQL-style $1, $2 parameters by default.
 */
export type ParameterStyle = 'postgres' | 'positional';
/**
 * Options for building WHERE clauses
 */
export interface BuildWhereOptions {
    /**
     * Parameter style to use ('postgres' for $1, $2 or 'positional' for ?)
     * @default 'postgres'
     */
    parameterStyle?: ParameterStyle;
    /**
     * Whether to include the WHERE keyword in the result
     * @default false
     */
    includeWhereKeyword?: boolean;
    /**
     * Whether to quote field names
     * @default true
     */
    quoteFields?: boolean;
}
/**
 * Builds a WHERE clause from a RevealWhere query object.
 * Supports nested AND/OR conditions and various operators.
 *
 * @param where - The WHERE condition object
 * @param params - Array to push parameter values into (mutated)
 * @param options - Build options
 * @returns SQL WHERE clause (without WHERE keyword by default)
 */
export declare function buildWhereClause(where: RevealWhere | RevealFindOptions['where'] | undefined, params: unknown[], options?: BuildWhereOptions): string;
/**
 * Extracts parameter values from a RevealWhere query object.
 * Used for building parameter arrays separately from WHERE clauses.
 *
 * @param where - The WHERE condition object
 * @returns Array of parameter values in order
 */
export declare function extractWhereValues(where?: RevealWhere): unknown[];
//# sourceMappingURL=queryBuilder.d.ts.map