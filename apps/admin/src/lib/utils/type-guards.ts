/**
 * Runtime type guards for admin document narrowing.
 *
 * Replaces `as unknown as T` double casts with runtime validation.
 * All RevealUI collections use text('id').primaryKey()  -  IDs are always
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

/**
 * Narrows a typed document back to RevealDocument for hook return values.
 *
 * admin hooks must return RevealDocument. Enriched objects (EnrichedProduct, etc.)
 * have an `id` and are structurally compatible, but TypeScript can't prove it
 * because RevealDocument uses an index signature. This guard validates at runtime.
 */
export function toRevealDocument(value: unknown): import('@revealui/core').RevealDocument {
  if (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as Record<string, unknown>).id === 'string' ||
      typeof (value as Record<string, unknown>).id === 'number')
  ) {
    return value as import('@revealui/core').RevealDocument;
  }
  throw new Error(`Invalid RevealDocument: expected object with 'id', got ${typeof value}`);
}

/**
 * Bridge between two type systems that describe the same document shape.
 *
 * admin types (e.g., `Product` from @revealui/core/types/admin) and Contracts types
 * (e.g., `Product` from @revealui/contracts/entities) describe the same documents
 * but are structurally incompatible in TypeScript. This guard validates the object
 * has an `id` before casting, providing a runtime safety net at the boundary.
 */
export function asBridgedDoc<T extends { id: string | number }>(value: unknown): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    (typeof (value as Record<string, unknown>).id === 'string' ||
      typeof (value as Record<string, unknown>).id === 'number')
  ) {
    return value as T;
  }
  throw new Error(`Invalid bridged document: expected object with 'id', got ${typeof value}`);
}

/**
 * Narrows a normalized block/component props object.
 *
 * Generated admin types and component prop types have minor structural differences
 * (null vs undefined, number vs string IDs). Normalizer functions fix these at
 * runtime. This guard validates the result is a non-null object with a `blockType`
 * before casting to the target component props type.
 */
export function asNormalizedProps<T>(value: unknown): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    'blockType' in value &&
    typeof (value as Record<string, unknown>).blockType === 'string'
  ) {
    return value as T;
  }
  throw new Error(`Invalid block props: expected object with 'blockType', got ${typeof value}`);
}
