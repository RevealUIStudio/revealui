/**
 * Update Operation
 *
 * Updates an existing document with access control, validation, password hashing, and JSON field handling.
 */

import bcrypt from 'bcryptjs';
import { defaultLogger } from '../../instance/logger.js';
import type {
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealDocument,
  RevealRequest,
  RevealUIField,
  RevealUpdateOptions,
} from '../../types/index.js';
import { collectJsonFields, serializeValueForDatabase } from '../../utils/json-parsing.js';
import { flattenFields, isJsonFieldType } from '../../utils/type-guards.js';
import { runBeforeFieldHooks } from './fieldHooks.js';
import { findByID } from './findById.js';
import {
  checkExistsByIdQuery,
  selectJsonByIdQuery,
  updateByIdQuery,
  updateByIdWithVersionQuery,
} from './sqlAdapter.js';

/**
 * Recursively deep-merge two plain objects. Arrays, nulls, Dates, and
 * primitives in `source` replace the corresponding key in `target`.
 * Only plain-object vs plain-object pairs are merged recursively.
 */
function deepMergeJson(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = structuredClone(target);
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMergeJson(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = structuredClone(sourceVal);
    }
  }
  return result;
}

/**
 * Evaluate a collection's access.update function.
 * Returns true (allow) or false (deny).
 */
async function evaluateUpdateAccess(
  config: RevealCollectionConfig,
  options: RevealUpdateOptions,
): Promise<boolean> {
  if (options.overrideAccess) return true;

  const accessConfig = (
    config as {
      access?: {
        update?: (args: {
          req: RevealRequest;
          id?: string | number;
          data?: Record<string, unknown>;
        }) => unknown;
      };
    }
  ).access;
  const updateAccess = accessConfig?.update;

  // No access rule defined = allow all (backward compatible)
  if (!updateAccess) return true;

  const req = options.req;
  if (!req) return false; // No request context = deny (safe default)

  const result = await updateAccess({ req, id: options.id, data: options.data });

  if (result === false) return false;

  // Any truthy result (true, WhereClause) = allowed for single-document operations
  return !!result;
}

export async function update(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: RevealUpdateOptions,
): Promise<RevealDocument> {
  const { id, data } = options;

  // --- Access control enforcement ---
  const allowed = await evaluateUpdateAccess(config, options);
  if (!allowed) {
    throw new Error('Access denied: insufficient permissions to update this document');
  }

  // Run beforeValidate field hooks before validation so they can transform values.
  await runBeforeFieldHooks(config, data, 'update', 'beforeValidate', undefined, options.req);

  // Validate email format if email field is being updated
  if (config.fields) {
    for (const field of config.fields) {
      // Skip fields without a name (should not happen, but TypeScript requires this check)
      if (!field.name) {
        continue;
      }

      // Validate email format if field type is email OR field name is "email"
      // This handles cases where field is named "email" but type might be "text"
      const isEmailField = field.type === 'email' || field.name.toLowerCase() === 'email';
      if (
        isEmailField &&
        field.name in data &&
        data[field.name] !== null &&
        data[field.name] !== undefined
      ) {
        const emailValue = data[field.name];
        if (typeof emailValue !== 'string') {
          throw new Error(`Field '${field.name}' must be a string`);
        }
        // Stricter email validation regex (RFC 5322 compliant subset)
        // Allows: alphanumeric, dots, hyphens, plus signs, underscores before @
        // Requires: valid domain with at least one dot (TLD required)
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
        if (!emailRegex.test(emailValue)) {
          throw new Error(`Field '${field.name}' must be a valid email address`);
        }
      }
    }
  }

  // Run beforeChange field hooks after validation but before the DB write.
  await runBeforeFieldHooks(config, data, 'update', 'beforeChange', undefined, options.req);

  // Hash password if present and not already hashed (doesn't start with $2a$ or $2b$)
  if (data.password && typeof data.password === 'string' && !data.password.startsWith('$2')) {
    const saltRounds = 12;
    data.password = await bcrypt.hash(data.password, saltRounds);
  }

  if (db?.query) {
    // Dynamic collection storage is quarantined in sqlAdapter.ts until this
    // layer is redesigned around typed tables that Drizzle can model directly.
    const tableName = config.slug;

    // Build UPDATE query (PostgreSQL uses $1, $2 style)
    // Serialize complex values (objects, arrays) to JSON strings for SQLite
    // Filter out fields that should be stored as JSON (not as columns)
    const jsonFieldNames = new Set<string>(
      flattenFields(config.fields || [])
        .filter((field: RevealUIField) => isJsonFieldType(field) && field.name)
        .map((field: RevealUIField) => field.name)
        .filter((name: string | undefined): name is string => typeof name === 'string'),
    );
    // Build allowlist from collection fields + system columns to prevent SQL injection via crafted keys
    const allowedColumns = new Set<string>([
      'id',
      'createdAt',
      'updatedAt',
      'created_at',
      'updated_at',
      '_json',
      'password',
    ]);
    if (config.fields) {
      for (const field of config.fields) {
        if (field.name) allowedColumns.add(field.name);
      }
    }

    const keys = Object.keys(data).filter(
      (k) => k !== 'id' && !jsonFieldNames.has(k) && allowedColumns.has(k),
    );
    const jsonKeys = Object.keys(data).filter((k) => k !== 'id' && jsonFieldNames.has(k));

    // Collect JSON fields to update using collectJsonFields utility
    const jsonUpdates = collectJsonFields(data, jsonFieldNames);

    // Fetch existing _json to merge with updates (single query instead of two)
    // Also verify document exists by checking if row exists
    // If collection has JSON fields, we always fetch _json to preserve existing JSON when updating non-JSON fields
    let existingJson: Record<string, unknown> = {};
    if (jsonFieldNames.size > 0) {
      // Fetch _json to preserve existing JSON fields (even when only updating non-JSON fields)
      const rawQuery = selectJsonByIdQuery(tableName);
      const rawResult = await db.query(rawQuery, [String(id)]);

      if (!rawResult.rows[0]) {
        throw new Error(`Document with id ${id} not found`);
      }

      if (rawResult.rows[0]._json !== null && rawResult.rows[0]._json !== undefined) {
        try {
          const rawJson: unknown = rawResult.rows[0]._json;
          if (typeof rawJson === 'string') {
            const parsed = JSON.parse(rawJson) as unknown;
            existingJson =
              parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {};
          } else if (rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)) {
            existingJson = rawJson as Record<string, unknown>;
          }
        } catch (error) {
          // Log JSON parse error for debugging
          defaultLogger.warn(
            `[CollectionOperations] Failed to parse _json for ${tableName}.id=${id}:`,
            error,
          );
          existingJson = {};
        }
      }
    } else if (keys.length > 0) {
      // No JSON fields in collection - just verify document exists
      const checkQuery = checkExistsByIdQuery(tableName);
      const checkResult = await db.query(checkQuery, [String(id)]);
      if (!checkResult.rows[0]) {
        throw new Error(`Document with id ${id} not found`);
      }
    }

    // Merge existing JSON with updates (only if we have JSON fields)
    let mergedJson: Record<string, unknown> = {};
    if (jsonFieldNames.size > 0) {
      mergedJson = deepMergeJson(existingJson, jsonUpdates);

      // Only include _json in UPDATE if there are actual changes or existing JSON to preserve
      if (jsonKeys.length > 0 || Object.keys(existingJson).length > 0) {
        keys.push('_json');
      }
    }

    const values = keys.map((key) => {
      if (key === '_json') {
        // Serialize merged JSON fields object to JSON string
        return serializeValueForDatabase(mergedJson);
      }
      // Serialize non-primitive values to JSON strings for SQLite compatibility
      return serializeValueForDatabase(data[key]);
    });

    // Ensure id is a string for consistent comparison
    const idString = String(id);

    // Optimistic locking: if the caller provides a `version` field, use version-aware update
    // to detect concurrent modifications. The version is stripped from the SET clause and
    // moved to the WHERE clause; the DB auto-increments version on success.
    const clientVersion = typeof data.version === 'number' ? data.version : undefined;
    const updateKeys = clientVersion !== undefined ? keys.filter((k) => k !== 'version') : keys;
    const updateValues =
      clientVersion !== undefined
        ? updateKeys.map((key) => {
            if (key === '_json') return serializeValueForDatabase(mergedJson);
            return serializeValueForDatabase(data[key]);
          })
        : values;

    if (clientVersion !== undefined) {
      const query = updateByIdWithVersionQuery(tableName, updateKeys);
      const result = await db.query(query, [...updateValues, clientVersion, idString]);
      if (result.rowCount === 0) {
        // Document exists but version mismatch  -  concurrent edit detected
        const err = new Error('Document was modified by another user. Refresh and try again.');
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }
    } else {
      const query = updateByIdQuery(tableName, updateKeys);
      await db.query(query, [...updateValues, idString]);
    }

    // Return updated document (use idString for consistency)
    const updatedDoc = await findByID(config, db, { id: idString });
    if (!updatedDoc) {
      throw new Error(`Document with id ${idString} not found after update`);
    }
    return updatedDoc;
  }

  return { ...data, id };
}
