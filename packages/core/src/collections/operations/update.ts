/**
 * Update Operation
 *
 * Updates an existing document with validation, password hashing, and JSON field handling.
 */

import bcrypt from 'bcryptjs'
import { defaultLogger } from '../../instance/logger.js'
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealDocument,
  RevealUIField,
  RevealUpdateOptions,
} from '../../types/index.js'
import { collectJsonFields, serializeValueForDatabase } from '../../utils/json-parsing.js'
import { flattenFields, isJsonFieldType } from '../../utils/type-guards.js'
import { findByID } from './findById.js'

export async function update(
  config: RevealCollectionConfig,
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  } | null,
  options: RevealUpdateOptions,
): Promise<RevealDocument> {
  const { id, data } = options

  // Validate email format if email field is being updated
  if (config.fields) {
    for (const field of config.fields) {
      // Skip fields without a name (should not happen, but TypeScript requires this check)
      if (!field.name) {
        continue
      }

      // Validate email format if field type is email OR field name is "email"
      // This handles cases where field is named "email" but type might be "text"
      const isEmailField = field.type === 'email' || field.name.toLowerCase() === 'email'
      if (
        isEmailField &&
        field.name in data &&
        data[field.name] !== null &&
        data[field.name] !== undefined
      ) {
        const emailValue = data[field.name]
        if (typeof emailValue !== 'string') {
          throw new Error(`Field '${field.name}' must be a string`)
        }
        // Stricter email validation regex (RFC 5322 compliant subset)
        // Allows: alphanumeric, dots, hyphens, plus signs, underscores before @
        // Requires: valid domain with at least one dot (TLD required)
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
        if (!emailRegex.test(emailValue)) {
          throw new Error(`Field '${field.name}' must be a valid email address`)
        }
      }
    }
  }

  // Hash password if present and not already hashed (doesn't start with $2a$ or $2b$)
  if (data.password && typeof data.password === 'string' && !data.password.startsWith('$2')) {
    const saltRounds = 10
    data.password = await bcrypt.hash(data.password, saltRounds)
  }

  if (db?.query) {
    const tableName = config.slug

    // Build UPDATE query (PostgreSQL uses $1, $2 style)
    // Serialize complex values (objects, arrays) to JSON strings for SQLite
    // Filter out fields that should be stored as JSON (not as columns)
    const jsonFieldNames = new Set<string>(
      flattenFields(config.fields || [])
        .filter((field: RevealUIField) => isJsonFieldType(field) && field.name)
        .map((field: RevealUIField) => field.name)
        .filter((name: string | undefined): name is string => typeof name === 'string'),
    )
    const keys = Object.keys(data).filter((k) => k !== 'id' && !jsonFieldNames.has(k))
    const jsonKeys = Object.keys(data).filter((k) => k !== 'id' && jsonFieldNames.has(k))

    // Collect JSON fields to update using collectJsonFields utility
    const jsonUpdates = collectJsonFields(data, jsonFieldNames)

    // Fetch existing _json to merge with updates (single query instead of two)
    // Also verify document exists by checking if row exists
    // If collection has JSON fields, we always fetch _json to preserve existing JSON when updating non-JSON fields
    let existingJson: Record<string, unknown> = {}
    if (jsonFieldNames.size > 0) {
      // Fetch _json to preserve existing JSON fields (even when only updating non-JSON fields)
      const rawQuery = `SELECT _json FROM "${tableName}" WHERE id = $1 LIMIT 1`
      const rawResult = await db.query(rawQuery, [String(id)])

      if (!rawResult.rows[0]) {
        throw new Error(`Document with id ${id} not found`)
      }

      if (rawResult.rows[0]._json !== null && rawResult.rows[0]._json !== undefined) {
        try {
          const rawJson: unknown = rawResult.rows[0]._json
          if (typeof rawJson === 'string') {
            const parsed = JSON.parse(rawJson) as unknown
            existingJson =
              parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {}
          } else if (rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)) {
            existingJson = rawJson as Record<string, unknown>
          }
        } catch (error) {
          // Log JSON parse error for debugging
          defaultLogger.warn(
            `[CollectionOperations] Failed to parse _json for ${tableName}.id=${id}:`,
            error,
          )
          existingJson = {}
        }
      }
    } else if (keys.length > 0) {
      // No JSON fields in collection - just verify document exists
      const checkQuery = `SELECT id FROM "${tableName}" WHERE id = $1 LIMIT 1`
      const checkResult = await db.query(checkQuery, [String(id)])
      if (!checkResult.rows[0]) {
        throw new Error(`Document with id ${id} not found`)
      }
    }

    // Merge existing JSON with updates (only if we have JSON fields)
    let mergedJson: Record<string, unknown> = {}
    if (jsonFieldNames.size > 0) {
      mergedJson = { ...existingJson, ...jsonUpdates }

      // Only include _json in UPDATE if there are actual changes or existing JSON to preserve
      if (jsonKeys.length > 0 || Object.keys(existingJson).length > 0) {
        keys.push('_json')
      }
    }

    const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ')
    const values = keys.map((key) => {
      if (key === '_json') {
        // Serialize merged JSON fields object to JSON string
        return serializeValueForDatabase(mergedJson)
      }
      // Serialize non-primitive values to JSON strings for SQLite compatibility
      return serializeValueForDatabase(data[key])
    })

    // Ensure id is a string for consistent comparison
    const idString = String(id)
    const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${keys.length + 1}`
    await db.query(query, [...values, idString])

    // Return updated document (use idString for consistency)
    const updatedDoc = await findByID(config, db, { id: idString })
    if (!updatedDoc) {
      throw new Error(`Document with id ${idString} not found after update`)
    }
    return updatedDoc
  }

  return { ...data, id }
}
