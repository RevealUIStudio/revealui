/**
 * Find By ID Operation
 *
 * Finds a single document by ID with optional relationship population.
 */

import { afterRead } from '../../fields/hooks/afterRead/index.js'
import type {
  DatabaseResult,
  PopulateType,
  RevealCollectionConfig,
  RevealDocument,
  RevealRequest,
  SanitizedCollectionConfig,
} from '../../types/index.js'
import { deserializeJsonFields } from '../../utils/json-parsing.js'

export async function findByID(
  config: RevealCollectionConfig,
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  } | null,
  options: {
    id: string | number
    depth?: number
    req?: RevealRequest
    populate?: PopulateType
  },
): Promise<RevealDocument | null> {
  const { id, depth = 0, req, populate: populateOption } = options

  // Validate depth
  if (depth < 0 || depth > 3) {
    throw new Error(`Depth must be between 0 and 3, got ${depth}`)
  }

  if (db?.query) {
    const tableName = config.slug
    // Ensure id is a string for consistent comparison
    const idString = String(id)
    const query = `SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`
    const result = await db.query(query, [idString])
    const rawDoc = result.rows[0]

    if (!rawDoc) {
      // Don't throw here, just return null as expected
      return null
    }

    // Deserialize JSON strings back to objects/arrays for SQLite compatibility
    const doc = deserializeJsonFields(rawDoc, `${tableName}.id=${id}`)

    // Use afterRead hook system for relationship population
    if (req && depth > 0) {
      // Adapt collection config to sanitized format
      // RevealCollectionConfig extends CollectionConfig, which matches SanitizedCollectionConfig structure
      const sanitizedConfig = {
        ...config,
        fields: config.fields as SanitizedCollectionConfig['fields'],
        flattenedFields: config.fields as SanitizedCollectionConfig['flattenedFields'],
        endpoints: config.endpoints === false ? undefined : config.endpoints,
      } as SanitizedCollectionConfig

      return await afterRead({
        collection: sanitizedConfig,
        context: req.context || {},
        currentDepth: 1,
        depth,
        doc,
        draft: false,
        fallbackLocale: req.fallbackLocale || 'en',
        findMany: false,
        flattenLocales: true,
        global: null,
        locale: req.locale || 'en',
        overrideAccess: false,
        populate: populateOption,
        req,
        select: undefined,
        showHiddenFields: false,
      })
    }

    return doc
  }

  return null
}
