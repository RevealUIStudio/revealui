/**
 * Create Operation
 *
 * Creates a new document with access control, validation, password hashing,
 * and JSON field handling.
 */

import bcrypt from 'bcryptjs';
import type {
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealCreateOptions,
  RevealDocument,
  RevealRequest,
  RevealUIField,
} from '../../types/index.js';
import { collectJsonFields, serializeValueForDatabase } from '../../utils/json-parsing.js';
import { flattenFields, isJsonFieldType } from '../../utils/type-guards.js';
import { runBeforeFieldHooks } from './fieldHooks.js';
import { findByID } from './findById.js';
import { insertDocumentQuery } from './sqlAdapter.js';

/**
 * Evaluate a collection's access.create function.
 * Returns true (allow) or false (deny).
 */
async function evaluateCreateAccess(
  config: RevealCollectionConfig,
  options: RevealCreateOptions,
): Promise<boolean> {
  if (options.overrideAccess) return true;

  const accessConfig = (
    config as {
      access?: {
        create?: (args: { req: RevealRequest; data?: Record<string, unknown> }) => unknown;
      };
    }
  ).access;
  const createAccess = accessConfig?.create;

  // No access rule defined = allow all (backward compatible)
  if (!createAccess) return true;

  const req = options.req;
  if (!req) return false; // No request context = deny (safe default)

  const result = await createAccess({ req, data: options.data });

  if (result === false) return false;

  // Any truthy result (true, WhereClause) = allowed
  return !!result;
}

export async function create(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: RevealCreateOptions,
): Promise<RevealDocument> {
  const { data } = options;

  // --- Access control enforcement ---
  const allowed = await evaluateCreateAccess(config, options);
  if (!allowed) {
    throw new Error('Access denied: insufficient permissions to create this document');
  }

  // Run beforeValidate field hooks first so they can generate values (e.g. slug from title)
  // before the required-field check below throws for missing values.
  await runBeforeFieldHooks(config, data, 'create', 'beforeValidate', undefined, options.req);

  // Validate required fields and field types
  if (config.fields) {
    for (const field of config.fields) {
      // Skip fields without a name (should not happen, but TypeScript requires this check)
      if (!field.name) {
        continue;
      }

      if (field.required && !(field.name in data)) {
        throw new Error(`Field '${field.name}' is required but was not provided`);
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
  await runBeforeFieldHooks(config, data, 'create', 'beforeChange', undefined, options.req);

  // Hash password if present and not already hashed (doesn't start with $2a$ or $2b$)
  if (data.password && typeof data.password === 'string' && !data.password.startsWith('$2')) {
    const saltRounds = 12;
    data.password = await bcrypt.hash(data.password, saltRounds);
  }

  if (db?.query) {
    // Dynamic collection storage is quarantined in sqlAdapter.ts until this
    // layer is redesigned around typed tables that Drizzle can model directly.
    const tableName = config.slug;

    // Generate ID if not provided - always ensure it's a string
    const id = String(
      typeof data.id === 'string' || typeof data.id === 'number'
        ? data.id
        : `rvl_${crypto.randomUUID()}`,
    );

    // Build INSERT query (PostgreSQL uses $1, $2 style)
    // Serialize complex values (objects, arrays) to JSON strings for SQLite
    // Filter out fields that should be stored as JSON (not as columns)
    const jsonFieldNames = new Set<string>(
      flattenFields(config.fields || [])
        .filter((field: RevealUIField) => isJsonFieldType(field) && field.name)
        .map((field: RevealUIField) => field.name)
        .filter((name: string | undefined): name is string => typeof name === 'string'),
    );
    const columns = Object.keys(data).filter((k) => k !== 'id' && !jsonFieldNames.has(k));

    // Collect JSON fields into a single object using collectJsonFields utility
    const jsonData = collectJsonFields(data, jsonFieldNames);

    // Include _json column if there are JSON fields to store
    const hasJsonFields = Object.keys(jsonData).length > 0;
    if (hasJsonFields) {
      columns.push('_json');
    }

    const values = columns.map((key) => {
      if (key === '_json') {
        // Serialize JSON fields object to JSON string
        return serializeValueForDatabase(jsonData);
      }
      // Serialize non-primitive values to JSON strings for SQLite compatibility
      return serializeValueForDatabase(data[key]);
    });

    const query = insertDocumentQuery(tableName, columns);

    // Wrap INSERT + read-back in a single transaction so both run on the same
    // connection and snapshot. Without this, pooled pg adapters check out a
    // fresh client per `db.query()` call, and the post-insert `findByID` can
    // see a pre-INSERT snapshot — throwing "Document not found in database"
    // even though the row is present (see revealui#383).
    //
    // Adapters without `transaction` (e.g. test mocks, in-memory stores with
    // same-connection visibility like PGlite used directly without our wrapper)
    // fall back to sequential queries.
    if (db.transaction) {
      return await db.transaction(async (tx) => {
        await tx.query(query, [id, ...values]);
        // The create operation has already passed access control above.
        // The read-back must use overrideAccess to avoid a second access
        // check that fails when there's no req context (e.g. bootstrap).
        const createdDoc = await findByID(config, tx, { id, overrideAccess: true });
        if (!createdDoc) {
          throw new Error(
            `Failed to retrieve created document with id ${id}. Document not found in database.`,
          );
        }
        return createdDoc;
      });
    }

    await db.query(query, [id, ...values]);
    const createdDoc = await findByID(config, db, { id, overrideAccess: true });
    if (!createdDoc) {
      throw new Error(
        `Failed to retrieve created document with id ${id}. Document not found in database.`,
      );
    }
    return createdDoc;
  }

  // Fallback
  const id =
    typeof data.id === 'string' || typeof data.id === 'number'
      ? data.id
      : `rvl_${crypto.randomUUID()}`;
  return { ...data, id };
}
