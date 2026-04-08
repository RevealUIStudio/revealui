/**
 * Validation Utilities
 *
 * Provides validation functions for context keys, values, and objects
 * to prevent security vulnerabilities and performance issues.
 */

import { ValidationError } from '../errors/index.js';

/**
 * Dangerous keys that could lead to prototype pollution or other security issues
 */
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
]);

/**
 * Maximum allowed depth for nested objects (prevents stack overflow)
 */
const MAX_OBJECT_DEPTH = 100;

/**
 * Maximum allowed size for context objects (in bytes, approximate)
 * This prevents memory exhaustion attacks
 */
const MAX_CONTEXT_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Maximum number of keys in a context object
 */
const MAX_CONTEXT_KEYS = 10000;

/**
 * Validates that a context key is safe to use.
 *
 * @param key - The key to validate
 * @throws ValidationError if key is dangerous or invalid
 */
export function validateContextKey(key: string): void {
  if (typeof key !== 'string') {
    throw new ValidationError(`Context key must be a string, got: ${typeof key}`);
  }

  if (key.length === 0) {
    throw new ValidationError('Context key cannot be empty');
  }

  if (key.length > 256) {
    throw new ValidationError(`Context key too long: ${key.length} characters (max 256)`);
  }

  if (DANGEROUS_KEYS.has(key)) {
    throw new ValidationError(
      `Dangerous context key detected: ${key}. This key is not allowed for security reasons.`,
    );
  }
}

/**
 * Validates that a context value is safe to store.
 *
 * @param value - The value to validate
 * @param key - The key this value is associated with (for error messages)
 * @throws ValidationError if value is invalid
 */
export function validateContextValue(value: unknown, key: string): void {
  if (value === undefined) {
    throw new ValidationError(`Context values cannot be undefined. Key: ${key}`);
  }

  if (typeof value === 'function') {
    throw new ValidationError(`Context values cannot be functions. Key: ${key}`);
  }

  if (typeof value === 'symbol') {
    throw new ValidationError(`Context values cannot be symbols. Key: ${key}`);
  }
}

/**
 * Validates the depth of a nested object structure.
 *
 * @param obj - The object to check
 * @param maxDepth - Maximum allowed depth (default: MAX_OBJECT_DEPTH)
 * @returns The actual depth of the object
 * @throws Error if depth exceeds maximum
 */
export function validateObjectDepth(obj: unknown, maxDepth = MAX_OBJECT_DEPTH): number {
  if (obj === null || typeof obj !== 'object') {
    return 0;
  }

  if (Array.isArray(obj)) {
    if (maxDepth <= 0) {
      throw new ValidationError(`Object depth exceeds maximum of ${MAX_OBJECT_DEPTH}`);
    }
    let maxChildDepth = 0;
    for (const item of obj) {
      const childDepth = validateObjectDepth(item, maxDepth - 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    return maxChildDepth + 1;
  }

  if (maxDepth <= 0) {
    throw new ValidationError(`Object depth exceeds maximum of ${MAX_OBJECT_DEPTH}`);
  }

  let maxChildDepth = 0;
  const record = obj as Record<string, unknown>;
  for (const value of Object.values(record)) {
    const childDepth = validateObjectDepth(value, maxDepth - 1);
    maxChildDepth = Math.max(maxChildDepth, childDepth);
  }
  return maxChildDepth + 1;
}

/**
 * Estimates the approximate size of an object in bytes.
 * This is a rough estimate for validation purposes.
 *
 * @param obj - The object to measure
 * @returns Approximate size in bytes
 */
export function estimateObjectSize(obj: unknown): number {
  if (obj === null || obj === undefined) {
    return 8; // null/undefined overhead
  }

  const type = typeof obj;
  if (type === 'string') {
    // UTF-16 char units × 2 bytes each. This over-estimates multi-byte UTF-8 code
    // points but is intentionally conservative — the limit stays tighter than the
    // real in-process memory cost, which is what we want for a safety bound.
    return (obj as string).length * 2 + 8;
  }

  if (type === 'number') {
    return 8; // 64-bit float
  }

  if (type === 'boolean') {
    return 4;
  }

  if (Array.isArray(obj)) {
    let size = 8; // array overhead
    for (const item of obj) {
      size += estimateObjectSize(item);
    }
    return size;
  }

  if (type === 'object') {
    let size = 8; // object overhead
    const record = obj as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      size += key.length * 2 + 8; // key size
      size += estimateObjectSize(value);
    }
    return size;
  }

  return 8; // fallback
}

/**
 * Validates that a context object is within size limits.
 *
 * @param context - The context object to validate
 * @throws Error if context exceeds size limits
 */
export function validateContextSize(context: Record<string, unknown>): void {
  const keyCount = Object.keys(context).length;
  if (keyCount > MAX_CONTEXT_KEYS) {
    throw new ValidationError(`Context has too many keys: ${keyCount} (max ${MAX_CONTEXT_KEYS})`);
  }

  const estimatedSize = estimateObjectSize(context);
  if (estimatedSize > MAX_CONTEXT_SIZE) {
    throw new ValidationError(
      `Context too large: ~${Math.round(estimatedSize / 1024)}KB (max ${Math.round(MAX_CONTEXT_SIZE / 1024)}KB)`,
    );
  }
}

/**
 * Validates a complete context object (keys, values, depth, size).
 *
 * @param context - The context object to validate
 * @throws Error if any validation fails
 */
export function validateContext(context: Record<string, unknown>): void {
  // Validate size first (fast check)
  validateContextSize(context);

  // Validate each key-value pair
  // Use Object.getOwnPropertyNames() to catch non-enumerable properties like __proto__
  // when set via Object.defineProperty() or similar
  const allKeys = Object.getOwnPropertyNames(context);
  for (const key of allKeys) {
    // Skip non-enumerable properties that aren't dangerous (like length on arrays)
    // But always check dangerous keys even if non-enumerable
    if (DANGEROUS_KEYS.has(key)) {
      validateContextKey(key);
      const value = context[key];
      validateContextValue(value, key);
    } else {
      // For enumerable properties, validate normally
      const descriptor = Object.getOwnPropertyDescriptor(context, key);
      if (descriptor?.enumerable) {
        validateContextKey(key);
        const value = context[key];
        validateContextValue(value, key);
      }
    }
  }

  // Also check if __proto__ exists as a property (even if not enumerable)
  // This catches cases where __proto__ is set via Object.defineProperty()
  if (Object.hasOwn(context, '__proto__')) {
    validateContextKey('__proto__');
    const protoDescriptor = Object.getOwnPropertyDescriptor(context, '__proto__');
    const value =
      protoDescriptor && 'value' in protoDescriptor
        ? (protoDescriptor.value as unknown)
        : undefined;
    validateContextValue(value, '__proto__');
  }

  // Validate depth
  validateObjectDepth(context);
}

/**
 * Checks if an object contains circular references.
 * This is a lightweight check that doesn't throw on circular refs,
 * but can be used to detect them before operations that would fail.
 *
 * @param obj - The object to check
 * @returns true if circular references are detected
 */
export function hasCircularReference(obj: unknown): boolean {
  const visited = new WeakSet<object>();

  function check(value: unknown): boolean {
    if (value === null || typeof value !== 'object') {
      return false;
    }

    const current = value;
    if (visited.has(current)) {
      return true; // Circular reference detected
    }

    visited.add(current);

    if (Array.isArray(value)) {
      for (const item of value) {
        if (check(item)) {
          return true;
        }
      }
    } else {
      const record = value as Record<string, unknown>;
      for (const item of Object.values(record)) {
        if (check(item)) {
          return true;
        }
      }
    }

    return false;
  }

  return check(obj);
}
