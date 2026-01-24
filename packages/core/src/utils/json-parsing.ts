/**
 * JSON Parsing Utilities
 *
 * Utilities for serializing and deserializing JSON fields in database operations.
 * Handles the _json column pattern used for storing complex field types.
 */

import { defaultLogger } from '../instance/logger.js'
import type { RevealDocument } from '../types/index.js'

/**
 * Parse a JSON field value safely
 *
 * @param value - Value to parse (may be string or already parsed object)
 * @returns Parsed value or original value if not JSON
 */
export function parseJsonField(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value)
    } catch {
      // Not valid JSON, keep as string
      return value
    }
  }

  return value
}

/**
 * Deserialize JSON fields from database document
 *
 * Handles the _json column pattern:
 * - PostgreSQL JSONB returns as object
 * - SQLite TEXT returns as string
 * - Merges _json fields into document
 * - Removes _json column from result
 * - Deserializes other JSON strings (backwards compatibility)
 *
 * @param doc - Raw document from database
 * @param tableName - Table name (for logging)
 * @returns Deserialized document
 */
export function deserializeJsonFields(
  doc: Record<string, unknown>,
  tableName?: string,
): RevealDocument {
  // Ensure id field exists (required by RevealDocument type)
  const result: RevealDocument = {
    id: typeof doc.id === 'string' || typeof doc.id === 'number' ? doc.id : String(doc.id ?? ''),
    ...doc,
  }

  // Handle _json column: deserialize and merge JSON fields into document
  if (result._json !== null && result._json !== undefined) {
    try {
      // PostgreSQL JSONB returns as object, SQLite TEXT returns as string
      const jsonFields = typeof result._json === 'string' ? JSON.parse(result._json) : result._json

      // Merge JSON fields into document
      if (jsonFields && typeof jsonFields === 'object') {
        Object.assign(result, jsonFields)
      }
    } catch (error) {
      // Invalid JSON - log for debugging but continue
      defaultLogger.warn(`Failed to parse _json in ${tableName || 'unknown'}:`, error)
    }
  }

  // Remove _json from result (internal column)
  Reflect.deleteProperty(result as Record<string, unknown>, '_json')

  // Deserialize other JSON strings (for backwards compatibility with non-JSON fields)
  for (const [key, value] of Object.entries(result)) {
    if (value === null || value === undefined) {
      result[key] = value
      continue
    }

    // Check for JSON string pattern
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        result[key] = JSON.parse(value)
      } catch {
        // Not valid JSON, keep as string
        result[key] = value
      }
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Collect JSON fields into an object for the _json column
 *
 * @param data - Data object
 * @param jsonFieldNames - Set of field names that should be stored as JSON
 * @returns Object containing JSON fields
 */
export function collectJsonFields(
  data: Record<string, unknown>,
  jsonFieldNames: Set<string>,
): Record<string, unknown> {
  const jsonData: Record<string, unknown> = {}

  jsonFieldNames.forEach((name) => {
    if (name in data && data[name] !== undefined) {
      jsonData[name] = data[name]
    }
  })

  return jsonData
}

/**
 * Serialize a value for database storage
 *
 * Converts objects and arrays to JSON strings for SQLite compatibility.
 * Primitives are returned as-is.
 *
 * @param value - Value to serialize
 * @returns Serialized value (string for objects/arrays, otherwise original value)
 */
export function serializeValueForDatabase(value: unknown): unknown {
  if (
    value !== null &&
    value !== undefined &&
    (typeof value === 'object' || Array.isArray(value))
  ) {
    return JSON.stringify(value)
  }
  return value
}
