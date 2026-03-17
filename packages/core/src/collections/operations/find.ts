/**
 * Find Operation
 *
 * Finds multiple documents with pagination, filtering, sorting, and relationship population.
 */

import { afterRead } from '../../fields/hooks/afterRead/index.js';
import { buildWhereClause } from '../../queries/queryBuilder.js';
import type {
  DatabaseResult,
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealRequest,
  RevealWhere,
  SanitizedCollectionConfig,
} from '../../types/index.js';
import { deserializeJsonFields } from '../../utils/json-parsing.js';
import { countDocumentsQuery, escapeIdentifier, listDocumentsQuery } from './sqlAdapter.js';

/**
 * Evaluate a collection's access.read function.
 * Returns true (allow all), false (deny all), or a WhereClause to merge into the query.
 */
async function evaluateReadAccess(
  config: RevealCollectionConfig,
  options: RevealFindOptions,
): Promise<true | false | RevealWhere> {
  // If overrideAccess is explicitly set, skip access checks (caller already validated permission)
  if (options.overrideAccess) return true;

  const accessConfig = (config as { access?: { read?: (args: { req: RevealRequest }) => unknown } })
    .access;
  const readAccess = accessConfig?.read;

  // No access rule defined = allow all (backward compatible)
  if (!readAccess) return true;

  const req = options.req;
  if (!req) return false; // No request context = deny (safe default)

  const result = await readAccess({ req });

  if (typeof result === 'boolean') return result;

  // WhereClause returned = row-level filtering (e.g. { author: { equals: user.id } })
  return result as RevealWhere;
}

export async function find(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: RevealFindOptions,
): Promise<RevealPaginatedResult> {
  const { where, limit = 10, page = 1, sort, depth = 0, req, populate: populateOption } = options;

  // Validate depth
  if (depth < 0 || depth > 3) {
    throw new Error(`Depth must be between 0 and 3, got ${depth}`);
  }

  // --- Access control enforcement ---
  const accessResult = await evaluateReadAccess(config, options);

  if (accessResult === false) {
    // Deny: return empty result set (same shape as a normal response)
    return {
      docs: [],
      totalDocs: 0,
      limit,
      totalPages: 0,
      page,
      pagingCounter: 0,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    };
  }

  // Merge access-control WhereClause with user-provided where filter
  const mergedWhere =
    accessResult === true ? where : where ? { and: [where, accessResult] } : accessResult;

  // Replace where in options for downstream use.
  // When access returned a WhereClause (not just boolean true), set overrideAccess: true
  // to prevent infinite recursion if collectionStorage.find re-invokes this function.
  const accessOptions =
    accessResult === true
      ? { ...options, where: mergedWhere }
      : { ...options, where: mergedWhere, overrideAccess: true };

  if (db?.collectionStorage?.find) {
    const result = await db.collectionStorage.find(config, accessOptions);
    if (result !== undefined) {
      if (req && depth > 0) {
        const sanitizedConfig = {
          ...config,
          fields: config.fields as SanitizedCollectionConfig['fields'],
          flattenedFields: config.fields as SanitizedCollectionConfig['flattenedFields'],
          endpoints: config.endpoints === false ? undefined : config.endpoints,
        } as SanitizedCollectionConfig;

        const docs = await Promise.all(
          result.docs.map(async (doc: (typeof result.docs)[number]) => {
            return await afterRead({
              collection: sanitizedConfig,
              context: req.context || {},
              currentDepth: 1,
              depth,
              doc,
              draft: false,
              fallbackLocale: req.fallbackLocale || 'en',
              findMany: true,
              flattenLocales: true,
              global: null,
              locale: req.locale || 'en',
              overrideAccess: false,
              populate: populateOption,
              req,
              select: undefined,
              showHiddenFields: false,
            });
          }),
        );

        return {
          ...result,
          docs,
        };
      }

      return result;
    }
  }

  // Build query based on database adapter
  if (db?.query) {
    // Dynamic collection storage is quarantined in sqlAdapter.ts until this
    // layer is redesigned around typed tables that Drizzle can model directly.
    const offset = (page - 1) * limit;
    const tableName = config.slug;

    // Build WHERE clause using query builder (uses access-merged where)
    const params: unknown[] = [];
    const whereClause = buildWhereClause(mergedWhere, params, {
      parameterStyle: 'postgres',
      includeWhereKeyword: false,
      quoteFields: true,
    });

    // Build ORDER BY clause with field name validation
    let orderByClause = '';
    if (sort) {
      // Build allowlist from collection fields + common system columns
      const allowedFields = new Set<string>([
        'id',
        'createdAt',
        'updatedAt',
        'created_at',
        'updated_at',
        '_json',
      ]);
      if (config.fields) {
        for (const field of config.fields) {
          if (field.name) allowedFields.add(field.name);
        }
      }

      const sortConditions: string[] = [];
      Object.entries(sort).forEach(([key, direction]) => {
        if (!allowedFields.has(key)) {
          throw new Error(
            `Invalid sort field: "${key}". Must be a defined field on the "${tableName}" collection.`,
          );
        }
        // Escape embedded double quotes in identifier to prevent SQL injection
        const escaped = escapeIdentifier(key);
        sortConditions.push(`"${escaped}" ${direction === '-1' ? 'DESC' : 'ASC'}`);
      });
      orderByClause = sortConditions.length > 0 ? `ORDER BY ${sortConditions.join(', ')}` : '';
    }

    // Execute count query (PostgreSQL)
    // whereClause should never start with "WHERE" when includeWhereKeyword: false
    // Add validation to catch any bugs
    if (whereClause?.trim().toUpperCase().startsWith('WHERE')) {
      throw new Error(
        `WHERE clause unexpectedly starts with "WHERE" keyword. This indicates a bug in buildWhereClause. Clause: ${whereClause}`,
      );
    }
    const countQuery = countDocumentsQuery(tableName, whereClause);
    const countResult = await db.query(countQuery, params);
    const totalDocs = Number(countResult.rows[0]?.total) || 0;

    // Execute data query (PostgreSQL uses $1, $2 for parameters)
    // whereClause should never start with "WHERE" when includeWhereKeyword: false
    // Add validation to catch any bugs
    if (whereClause?.trim().toUpperCase().startsWith('WHERE')) {
      throw new Error(
        `WHERE clause unexpectedly starts with "WHERE" keyword. This indicates a bug in buildWhereClause. Clause: ${whereClause}`,
      );
    }

    // Verify parameter count matches placeholder count
    const wherePlaceholderCount = (whereClause.match(/\$\d+/g) || []).length;
    const limitOffsetPlaceholders = 2; // LIMIT and OFFSET
    const totalPlaceholderCount = wherePlaceholderCount + limitOffsetPlaceholders;
    const totalParamCount = params.length + 2; // params from WHERE + limit + offset

    if (totalPlaceholderCount !== totalParamCount) {
      throw new Error(
        `Parameter count mismatch: Expected ${totalPlaceholderCount} placeholders (${wherePlaceholderCount} from WHERE + ${limitOffsetPlaceholders} for LIMIT/OFFSET), but got ${totalParamCount} parameters (${params.length} from WHERE + 2 for LIMIT/OFFSET). WHERE clause: ${whereClause}`,
      );
    }

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;
    const dataQuery = listDocumentsQuery(
      tableName,
      whereClause,
      orderByClause,
      limitParam,
      offsetParam,
    );
    const docsResult = await db.query(dataQuery, [...params, limit, offset]);
    let docs = docsResult.rows.map((row: DatabaseResult['rows'][number]) => {
      return deserializeJsonFields(row, tableName);
    });

    // Apply relationship population if depth > 0
    if (req && depth > 0) {
      // RevealCollectionConfig extends CollectionConfig, which matches SanitizedCollectionConfig structure
      const sanitizedConfig = {
        ...config,
        fields: config.fields as SanitizedCollectionConfig['fields'],
        flattenedFields: config.fields as SanitizedCollectionConfig['flattenedFields'],
        endpoints: config.endpoints === false ? undefined : config.endpoints,
      } as SanitizedCollectionConfig;

      docs = await Promise.all(
        docs.map(async (doc) => {
          return await afterRead({
            collection: sanitizedConfig,
            context: req.context || {},
            currentDepth: 1,
            depth,
            doc,
            draft: false,
            fallbackLocale: req.fallbackLocale || 'en',
            findMany: true,
            flattenLocales: true,
            global: null,
            locale: req.locale || 'en',
            overrideAccess: false,
            populate: populateOption,
            req,
            select: undefined,
            showHiddenFields: false,
          });
        }),
      );
    }

    const totalPages = Math.ceil(totalDocs / limit);

    return {
      docs,
      totalDocs,
      limit,
      totalPages,
      page,
      pagingCounter: offset + 1,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page > 1 ? page - 1 : null,
      nextPage: page < totalPages ? page + 1 : null,
    };
  }

  // Fallback for no database
  return {
    docs: [],
    totalDocs: 0,
    limit,
    totalPages: 0,
    page,
    pagingCounter: 0,
    hasPrevPage: false,
    hasNextPage: false,
    prevPage: null,
    nextPage: null,
  };
}
