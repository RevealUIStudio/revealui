/**
 * Create Operation
 *
 * Creates a new document with validation, password hashing, and JSON field handling.
 */

import bcrypt from 'bcryptjs'
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealCreateOptions,
  RevealDocument,
} from '../../types/index'
import { collectJsonFields, serializeValueForDatabase } from '../../utils/json-parsing'
import { isJsonFieldType } from '../../utils/type-guards'
import { findByID } from './findById'

export async function create(
  config: RevealCollectionConfig,
  db: { query: (query: string, values?: unknown[]) => Promise<DatabaseResult> } | null,
  options: RevealCreateOptions,
): Promise<RevealDocument> {
  const { data } = options

  // Validate required fields and field types
  if (config.fields) {
    for (const field of config.fields) {
      // Skip fields without a name (should not happen, but TypeScript requires this check)
      if (!field.name) {
        continue
      }

      if (field.required && !(field.name in data)) {
        throw new Error(`Field '${field.name}' is required but was not provided`)
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

    // Generate ID if not provided - always ensure it's a string
    const id = String(
      typeof data.id === 'string' || typeof data.id === 'number'
        ? data.id
        : `rvl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    )

    // Build INSERT query (PostgreSQL uses $1, $2 style)
    // Serialize complex values (objects, arrays) to JSON strings for SQLite
    // Filter out fields that should be stored as JSON (not as columns)
    const jsonFieldNames = new Set(
      (config.fields || [])
        .filter((field) => isJsonFieldType(field) && field.name)
        .map((field) => field.name!)
        .filter((name): name is string => typeof name === 'string'),
    )
    const columns = Object.keys(data).filter((k) => k !== 'id' && !jsonFieldNames.has(k))

    // Collect JSON fields into a single object using collectJsonFields utility
    const jsonData = collectJsonFields(data, jsonFieldNames)

    // Include _json column if there are JSON fields to store
    const hasJsonFields = Object.keys(jsonData).length > 0
    if (hasJsonFields) {
      columns.push('_json')
    }

    const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ')
    const values = columns.map((key) => {
      if (key === '_json') {
        // Serialize JSON fields object to JSON string
        return serializeValueForDatabase(jsonData)
      }
      // Serialize non-primitive values to JSON strings for SQLite compatibility
      return serializeValueForDatabase(data[key])
    })

    const query = `INSERT INTO "${tableName}" (id, ${columns.map((c) => `"${c}"`).join(', ')}) VALUES ($1, ${placeholders})`
    await db.query(query, [id, ...values])

    // For SQLite with WAL mode, writes are immediately visible to readers on the same connection
    // Return the created document by fetching it from the database
    // This ensures we return what was actually stored (with proper JSON deserialization)
    // ID is already a string, so use it directly
    const createdDoc = await findByID(config, db, { id })
    if (!createdDoc) {
      throw new Error(
        `Failed to retrieve created document with id ${id}. Document not found in database.`,
      )
    }
    return createdDoc
  }

  // Fallback
  const id =
    typeof data.id === 'string' || typeof data.id === 'number'
      ? data.id
      : `rvl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  return { ...data, id }
}
