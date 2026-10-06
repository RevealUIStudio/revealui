/**
 * JSON Parsing Utilities
 *
 * Utilities for serializing and deserializing JSON fields in database operations.
 * Handles the _json column pattern used for storing complex field types.
 */

import { z } from 'zod';
import type { RevealDocument, RevealValue } from '../types/index.js';

const reservedFieldNames = new Set(['__proto__', 'constructor', 'prototype']);
const documentFieldNameSchema = z.string().refine((key) => !reservedFieldNames.has(key));

const documentIdSchema = z.union([z.string().min(1), z.number().finite()]);

// The schema receives opaque adapter/JSON values. Inspect keys before Zod
// records can omit __proto__; nested values share this same boundary check.
function rejectReservedFields(value: unknown, context: z.RefinementCtx) {
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).some((key) => reservedFieldNames.has(key))
  ) {
    context.addIssue({ code: 'custom', message: 'Reserved document field' });
  }
  return value;
}

const documentValueSchema: z.ZodType<RevealValue> = z.preprocess(
  rejectReservedFields,
  z.lazy(() =>
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.date(),
      z.array(documentValueSchema),
      z.record(documentFieldNameSchema, documentValueSchema),
    ]),
  ),
);
const documentRecordSchema = z.preprocess(
  rejectReservedFields,
  z.record(documentFieldNameSchema, documentValueSchema.optional()),
);

/** Validate already-decoded adapter documents without interpreting string fields. */
export function validateDocument(value: unknown, context: string): RevealDocument {
  // Public adapter implementations are external runtime inputs despite their
  // TypeScript return contract. Narrow the complete record before exposing it.
  const document = documentRecordSchema.safeParse(value);
  if (!document.success) throw new Error(`Invalid document in ${context}`);
  const id = documentIdSchema.safeParse(document.data.id);
  if (!id.success) throw new Error(`Invalid document id in ${context}`);
  return { ...document.data, id: id.data };
}

const extensionFieldsSchema = z.record(documentFieldNameSchema, documentValueSchema);

/**
 * Parse a JSON field value safely
 *
 * @param value - Value to parse (may be string or already parsed object)
 * @returns Parsed value or original value if not JSON
 */
export function parseJsonField(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value);
    } catch {
      // Not valid JSON, keep as string
      return value;
    }
  }

  return value;
}

/**
 * Validate stored extension content before reads or read-modify-write merges.
 * Opaque database/JSON parser input is narrowed by the shared runtime schema.
 * SQL NULL and absent legacy extensions retain their empty-object meaning.
 */
export function parseStoredJsonFields(
  encodedFields: unknown,
  context: string,
): Record<string, RevealValue> {
  // _json is required structured content when present. Parse and validate the
  // whole extension before constructing a result; corruption must fail the read.
  let extensionFields: Record<string, RevealValue> = {};
  if (encodedFields !== null && encodedFields !== undefined) {
    // JSON.parse has an unvalidated return type; unknown keeps it opaque until
    // the runtime schema below establishes the extension's actual shape.
    let parsedFields: unknown = encodedFields;
    if (typeof encodedFields === 'string') {
      try {
        parsedFields = JSON.parse(encodedFields);
      } catch {
        throw new Error(`Invalid _json JSON in ${context}`);
      }
    }
    if (parsedFields !== null && typeof parsedFields === 'object') {
      for (const key of Object.keys(parsedFields)) {
        if (key === 'id' || key === '_json' || reservedFieldNames.has(key)) {
          throw new Error(`Reserved _json field in ${context}: ${key}`);
        }
      }
    }
    const validatedFields = extensionFieldsSchema.safeParse(parsedFields);
    if (!validatedFields.success) {
      throw new Error(`Invalid _json object in ${context}`);
    }
    extensionFields = validatedFields.data;
  }

  return extensionFields;
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
 * @param tableName - Table name (for error context)
 * @returns Validated document with its database identity preserved
 * @throws When identity or required internal JSON is invalid
 */
export function deserializeJsonFields(
  doc: Record<string, unknown>,
  tableName?: string,
): RevealDocument {
  const context = tableName || 'unknown';
  const parsedId = documentIdSchema.safeParse(doc.id);
  if (!parsedId.success) throw new Error(`Invalid document id in ${context}`);
  const id = parsedId.data;

  const extensionFields = parseStoredJsonFields(doc._json, context);

  const result: RevealDocument = { id };
  for (const [key, value] of Object.entries({ ...doc, ...extensionFields })) {
    // The database identity is authoritative, including JSON-looking strings.
    // Neither extension data nor backwards-compatible parsing may replace it.
    if (key === 'id' || key === '_json') continue;
    if (reservedFieldNames.has(key)) {
      throw new Error(`Reserved document field in ${context}: ${key}`);
    }
    const parsed = documentValueSchema.optional().safeParse(parseJsonField(value));
    if (!parsed.success) {
      throw new Error(`Invalid document field in ${context}: ${key}`);
    }
    result[key] = parsed.data;
  }

  return result;
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
  const jsonData: Record<string, unknown> = {};

  jsonFieldNames.forEach((name) => {
    if (name in data && data[name] !== undefined) {
      jsonData[name] = data[name];
    }
  });

  return jsonData;
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
    return JSON.stringify(value);
  }
  return value;
}
