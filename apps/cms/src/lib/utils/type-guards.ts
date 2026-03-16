/**
 * Runtime type guards for CMS document narrowing.
 *
 * Replaces `as unknown as T` double casts with runtime validation.
 * All RevealUI collections use text('id').primaryKey() — IDs are always
 * strings or numbers.
 */

/**
 * Safely narrows a value to a typed document.
 * Validates that the value is a non-null object with an `id` field.
 */
export function asDocument<T extends { id: string | number }>(value: unknown): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as Record<string, unknown>).id === 'string' ||
      typeof (value as Record<string, unknown>).id === 'number')
  ) {
    return value as T;
  }
  throw new Error(
    `Invalid document: expected object with string or number 'id', got ${typeof value}`,
  );
}

/**
 * Safely narrows an array of values to typed documents.
 */
export function asDocuments<T extends { id: string | number }>(values: unknown[]): T[] {
  return values.map((v) => asDocument<T>(v));
}

/**
 * Narrows a value to a plain record (for indexer payloads, etc.).
 * Validates that the value is a non-null object.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  throw new Error(`Invalid record: expected object, got ${typeof value}`);
}
