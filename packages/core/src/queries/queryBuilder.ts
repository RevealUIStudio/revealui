import type { RevealFindOptions, RevealWhere } from '../types/index.js';

/**
 * Query Builder Utilities
 *
 * Handles building WHERE clauses from RevealWhere query objects.
 * Uses PostgreSQL-style $1, $2 parameters by default.
 */

export type ParameterStyle = 'postgres' | 'positional';

/** Escape SQL LIKE wildcards (%, _, \) in user input */
function escapeLikeWildcards(value: string): string {
  let result = '';
  for (const ch of value) {
    if (ch === '%' || ch === '_' || ch === '\\') {
      result += `\\${ch}`;
    } else {
      result += ch;
    }
  }
  return result;
}

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
export function buildWhereClause(
  where: RevealWhere | RevealFindOptions['where'] | undefined,
  params: unknown[],
  options: BuildWhereOptions = {},
): string {
  if (!where) {
    return '';
  }

  const { parameterStyle = 'postgres', includeWhereKeyword = false, quoteFields = true } = options;

  const getPlaceholder = (): string => {
    if (parameterStyle === 'postgres') {
      // Calculate placeholder BEFORE pushing to params array.
      // PostgreSQL uses 1-indexed placeholders ($1, $2, $3...).
      // If params.length = 0, next param will be at position 1 ($1).
      // If params.length = 1, next param will be at position 2 ($2).
      // Therefore: placeholder = params.length + 1
      return `$${params.length + 1}`;
    }
    return '?';
  };

  const quoteField = (field: string): string => {
    if (!quoteFields) return field;
    // Escape embedded double quotes to prevent SQL injection via identifier breakout
    const escaped = field.split('"').join('""');
    return `"${escaped}"`;
  };

  const whereWithGroups = where as { and?: RevealWhere[]; or?: RevealWhere[] };
  const isOperatorObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date);

  // Handle and/or groups
  if (Array.isArray(whereWithGroups.and)) {
    const conditions = whereWithGroups.and
      .map((w: RevealWhere) =>
        buildWhereClause(w, params, { ...options, includeWhereKeyword: false }),
      )
      .filter((c: string) => c.length > 0);

    if (conditions.length === 0) {
      return '';
    }

    const clause = conditions.join(' AND ');
    return includeWhereKeyword ? `WHERE ${clause}` : clause;
  }

  if (Array.isArray(whereWithGroups.or)) {
    const conditions = whereWithGroups.or
      .map((w: RevealWhere) => {
        const clause = buildWhereClause(w, params, {
          ...options,
          includeWhereKeyword: false,
        });
        // Ensure clause doesn't start with "WHERE" (should never happen with includeWhereKeyword: false, but defensive)
        if (clause.trim().toUpperCase().startsWith('WHERE')) {
          throw new Error(
            `buildWhereClause returned clause starting with "WHERE" when includeWhereKeyword is false. This indicates a bug in the query builder. Clause: ${clause}`,
          );
        }
        return clause;
      })
      .filter((c: string) => c.length > 0);

    if (conditions.length === 0) {
      return '';
    }

    const clause = `(${conditions.join(' OR ')})`;
    return includeWhereKeyword ? `WHERE ${clause}` : clause;
  }

  // Handle field conditions
  const conditions: string[] = [];

  // Valid operators for validation
  const validOperators = new Set([
    'equals',
    'not_equals',
    'in',
    'not_in',
    'contains',
    'greater_than',
    'less_than',
    'like',
    'exists',
  ]);

  for (const [field, condition] of Object.entries(where as Record<string, unknown>)) {
    // Skip special keys
    if (field === 'and' || field === 'or') {
      continue;
    }

    if (condition === null || condition === undefined) {
      continue;
    }

    const quotedField = quoteField(field);

    // If condition is a plain value, treat as equals
    if (!isOperatorObject(condition)) {
      // Get placeholder BEFORE pushing to ensure correct index
      const placeholder = getPlaceholder();
      params.push(condition);
      conditions.push(`${quotedField} = ${placeholder}`);
      continue;
    }

    // Handle operator objects
    if (isOperatorObject(condition)) {
      // Validate operators before processing
      const operatorKeys = Object.keys(condition).filter((key) => key !== 'and' && key !== 'or');
      const invalidOperators = operatorKeys.filter((key) => !validOperators.has(key));
      if (invalidOperators.length > 0) {
        throw new Error(
          `Invalid query operators: ${invalidOperators.join(', ')}. Valid operators are: ${Array.from(validOperators).join(', ')}`,
        );
      }

      // equals
      if ('equals' in condition && condition.equals !== undefined) {
        const placeholder = getPlaceholder();
        params.push(condition.equals);
        conditions.push(`${quotedField} = ${placeholder}`);
      }

      // not_equals
      if ('not_equals' in condition && condition.not_equals !== undefined) {
        const placeholder = getPlaceholder();
        params.push(condition.not_equals);
        conditions.push(`${quotedField} != ${placeholder}`);
      }

      // in
      if ('in' in condition && Array.isArray(condition.in)) {
        if (condition.in.length > 0) {
          const placeholders: string[] = [];
          for (const value of condition.in) {
            const placeholder = getPlaceholder();
            params.push(value);
            placeholders.push(placeholder);
          }
          conditions.push(`${quotedField} IN (${placeholders.join(', ')})`);
        } else {
          // Empty IN clause should match nothing
          conditions.push('1=0'); // Always false
        }
      }

      // not_in
      if ('not_in' in condition && Array.isArray(condition.not_in)) {
        if (condition.not_in.length > 0) {
          const placeholders: string[] = [];
          for (const value of condition.not_in) {
            const placeholder = getPlaceholder();
            params.push(value);
            placeholders.push(placeholder);
          }
          conditions.push(`${quotedField} NOT IN (${placeholders.join(', ')})`);
        }
      }

      // contains (LIKE with wildcards)
      if ('contains' in condition && typeof condition.contains === 'string') {
        const placeholder = getPlaceholder();
        // Escape LIKE wildcards (% and _) in user input to prevent wildcard injection
        const escaped = escapeLikeWildcards(condition.contains);
        params.push(`%${escaped}%`);
        conditions.push(`${quotedField} LIKE ${placeholder} ESCAPE '\\'`);
      }

      // greater_than
      if ('greater_than' in condition && condition.greater_than !== undefined) {
        const placeholder = getPlaceholder();
        params.push(condition.greater_than);
        conditions.push(`${quotedField} > ${placeholder}`);
      }

      // less_than
      if ('less_than' in condition && condition.less_than !== undefined) {
        const placeholder = getPlaceholder();
        params.push(condition.less_than);
        conditions.push(`${quotedField} < ${placeholder}`);
      }

      // like (escape wildcards to prevent blind LIKE probing)
      if ('like' in condition && typeof condition.like === 'string') {
        const placeholder = getPlaceholder();
        const escaped = escapeLikeWildcards(condition.like);
        params.push(escaped);
        conditions.push(`${quotedField} LIKE ${placeholder} ESCAPE '\\'`);
      }

      // exists (check if field is not null)
      if ('exists' in condition && typeof condition.exists === 'boolean') {
        if (condition.exists) {
          conditions.push(`${quotedField} IS NOT NULL`);
        } else {
          conditions.push(`${quotedField} IS NULL`);
        }
      }
    }
  }

  const clause = conditions.length > 0 ? conditions.join(' AND ') : '';
  const result = includeWhereKeyword && clause ? `WHERE ${clause}` : clause;

  // Defensive check: ensure we never return "WHERE" prefix when includeWhereKeyword is false
  if (!includeWhereKeyword && result.trim().toUpperCase().startsWith('WHERE')) {
    throw new Error(
      `buildWhereClause returned clause starting with "WHERE" when includeWhereKeyword is false. This indicates a bug in the query builder. Clause: ${result}`,
    );
  }

  return result;
}

/**
 * Extracts parameter values from a RevealWhere query object.
 * Used for building parameter arrays separately from WHERE clauses.
 *
 * @param where - The WHERE condition object
 * @returns Array of parameter values in order
 */
export function extractWhereValues(where?: RevealWhere): unknown[] {
  if (!where) return [];

  const values: unknown[] = [];

  for (const [field, operators] of Object.entries(where as Record<string, unknown>)) {
    if (field === 'and' || field === 'or') continue;

    if (
      typeof operators === 'object' &&
      operators !== null &&
      !Array.isArray(operators) &&
      !(operators instanceof Date)
    ) {
      for (const [op, value] of Object.entries(operators as Record<string, unknown>)) {
        switch (op) {
          case 'equals':
          case 'not_equals':
          case 'greater_than':
          case 'less_than':
            values.push(value);
            break;
          case 'contains':
            if (typeof value === 'string') {
              const escaped = escapeLikeWildcards(value);
              values.push(`%${escaped}%`);
            }
            break;
          case 'in':
            if (Array.isArray(value)) {
              values.push(...(value as unknown[]));
            }
            break;
          case 'not_in':
            if (Array.isArray(value)) {
              values.push(...(value as unknown[]));
            }
            break;
          case 'like':
            if (typeof value === 'string') {
              values.push(value);
            }
            break;
          // exists doesn't need a value
        }
      }
    } else if (operators !== null && operators !== undefined) {
      // Plain value (treated as equals)
      values.push(operators);
    }
  }

  const whereWithGroups = where as { and?: RevealWhere[]; or?: RevealWhere[] };

  // Handle nested conditions
  if (Array.isArray(whereWithGroups.and)) {
    for (const w of whereWithGroups.and) {
      values.push(...extractWhereValues(w));
    }
  }

  if (Array.isArray(whereWithGroups.or)) {
    for (const w of whereWithGroups.or) {
      values.push(...extractWhereValues(w));
    }
  }

  return values;
}
