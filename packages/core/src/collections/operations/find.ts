/**
 * Find Operation
 *
 * Finds multiple documents with pagination, filtering, sorting, and relationship population.
 */

import { afterRead } from '../../fields/hooks/afterRead/index.js'
import { buildWhereClause } from '../../queries/queryBuilder.js'
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealFindOptions,
  RevealPaginatedResult,
  SanitizedCollectionConfig,
} from '../../types/index.js'
import { deserializeJsonFields } from '../../utils/json-parsing.js'

export async function find(
  config: RevealCollectionConfig,
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  } | null,
  options: RevealFindOptions,
): Promise<RevealPaginatedResult> {
  const { where, limit = 10, page = 1, sort, depth = 0, req, populate: populateOption } = options

  // Validate depth
  if (depth < 0 || depth > 3) {
    throw new Error(`Depth must be between 0 and 3, got ${depth}`)
  }

  // Build query based on database adapter
  if (db?.query) {
    const offset = (page - 1) * limit
    const tableName = config.slug

    // Build WHERE clause using query builder
    const params: unknown[] = []
    const whereClause = buildWhereClause(where, params, {
      parameterStyle: 'postgres',
      includeWhereKeyword: false,
      quoteFields: true,
    })

    // Build ORDER BY clause
    let orderByClause = ''
    if (sort) {
      const sortConditions: string[] = []
      Object.entries(sort).forEach(([key, direction]) => {
        sortConditions.push(`"${key}" ${direction === '-1' ? 'DESC' : 'ASC'}`)
      })
      orderByClause = sortConditions.length > 0 ? `ORDER BY ${sortConditions.join(', ')}` : ''
    }

    // Execute count query (PostgreSQL)
    // whereClause should never start with "WHERE" when includeWhereKeyword: false
    // Add validation to catch any bugs
    if (whereClause?.trim().toUpperCase().startsWith('WHERE')) {
      throw new Error(
        `WHERE clause unexpectedly starts with "WHERE" keyword. This indicates a bug in buildWhereClause. Clause: ${whereClause}`,
      )
    }
    const countQuery = whereClause
      ? `SELECT COUNT(*) as total FROM "${tableName}" WHERE ${whereClause}`
      : `SELECT COUNT(*) as total FROM "${tableName}"`
    const countResult = await db.query(countQuery, params)
    const totalDocs = Number(countResult.rows[0]?.total) || 0

    // Execute data query (PostgreSQL uses $1, $2 for parameters)
    // whereClause should never start with "WHERE" when includeWhereKeyword: false
    // Add validation to catch any bugs
    if (whereClause?.trim().toUpperCase().startsWith('WHERE')) {
      throw new Error(
        `WHERE clause unexpectedly starts with "WHERE" keyword. This indicates a bug in buildWhereClause. Clause: ${whereClause}`,
      )
    }

    // Verify parameter count matches placeholder count
    const wherePlaceholderCount = (whereClause.match(/\$\d+/g) || []).length
    const limitOffsetPlaceholders = 2 // LIMIT and OFFSET
    const totalPlaceholderCount = wherePlaceholderCount + limitOffsetPlaceholders
    const totalParamCount = params.length + 2 // params from WHERE + limit + offset

    if (totalPlaceholderCount !== totalParamCount) {
      throw new Error(
        `Parameter count mismatch: Expected ${totalPlaceholderCount} placeholders (${wherePlaceholderCount} from WHERE + ${limitOffsetPlaceholders} for LIMIT/OFFSET), but got ${totalParamCount} parameters (${params.length} from WHERE + 2 for LIMIT/OFFSET). WHERE clause: ${whereClause}`,
      )
    }

    const limitParam = params.length + 1
    const offsetParam = params.length + 2
    const dataQuery = `SELECT * FROM "${tableName}" ${whereClause ? `WHERE ${whereClause}` : ''} ${orderByClause} LIMIT $${limitParam} OFFSET $${offsetParam}`
    const docsResult = await db.query(dataQuery, [...params, limit, offset])
    let docs = docsResult.rows.map((row) => {
      return deserializeJsonFields(row, tableName)
    })

    // Apply relationship population if depth > 0
    if (req && depth > 0) {
      // RevealCollectionConfig extends CollectionConfig, which matches SanitizedCollectionConfig structure
      const sanitizedConfig = {
        ...config,
        fields: config.fields as SanitizedCollectionConfig['fields'],
        flattenedFields: config.fields as SanitizedCollectionConfig['flattenedFields'],
        endpoints: config.endpoints === false ? undefined : config.endpoints,
      } as SanitizedCollectionConfig

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
          })
        }),
      )
    }

    const totalPages = Math.ceil(totalDocs / limit)

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
    }
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
  }
}
