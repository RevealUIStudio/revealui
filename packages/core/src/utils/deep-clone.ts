/**
 * Deep Clone Utility
 *
 * Properly deep clones objects, handling edge cases that JSON.parse(JSON.stringify()) misses:
 * - Preserves Date objects
 * - Handles undefined values (by omitting them, which is acceptable for our use case)
 * - Handles null values correctly
 * - Works with plain objects and arrays
 * - Handles Map, Set, RegExp, TypedArrays, ArrayBuffer
 * - Throws on circular references (fail-fast is better than silent corruption)
 *
 * This is a comprehensive deep clone implementation suitable for production use.
 * Moved from @revealui/ai/memory/utils/deep-clone.ts to @revealui/core/utils/deep-clone.ts
 * for shared usage across the framework.
 */

/**
 * Deep clones a plain object or array.
 *
 * @param obj - Object to clone
 * @param visited - Internal parameter to track visited objects (for circular reference detection)
 * @returns Deep cloned object
 * @throws Error if object contains circular references
 */
export function deepClone<T>(obj: T, visited = new WeakMap<object, unknown>()): T {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Check for circular references
  if (visited.has(obj as object)) {
    throw new Error('Circular reference detected in object');
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  // Handle RegExp objects
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as T;
  }

  // Handle Map objects
  if (obj instanceof Map) {
    visited.set(obj, new Map());
    const cloned = new Map();
    for (const [key, value] of obj.entries()) {
      cloned.set(deepClone(key, visited), deepClone(value, visited));
    }
    visited.delete(obj);
    return cloned as T;
  }

  // Handle Set objects
  if (obj instanceof Set) {
    visited.set(obj, new Set());
    const cloned = new Set();
    for (const value of obj.values()) {
      cloned.add(deepClone(value, visited));
    }
    visited.delete(obj);
    return cloned as T;
  }

  // Handle TypedArrays (Uint8Array, Int32Array, etc.)
  if (ArrayBuffer.isView(obj)) {
    const typedArray = obj as unknown as {
      buffer: ArrayBuffer;
      byteOffset: number;
      length: number;
    };
    const TypedArrayConstructor = obj.constructor as new (
      buffer: ArrayBufferLike,
      byteOffset?: number,
      length?: number,
    ) => T;
    return new TypedArrayConstructor(
      typedArray.buffer.slice(),
      typedArray.byteOffset,
      typedArray.length,
    );
  }

  // Handle ArrayBuffer
  if (obj instanceof ArrayBuffer) {
    return obj.slice(0) as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    visited.set(obj, []);
    const array = obj as unknown[];
    const cloned = array.map((item) => deepClone(item, visited));
    visited.delete(obj);
    return cloned as unknown as T;
  }

  // Handle plain objects
  if (typeof obj === 'object') {
    visited.set(obj, {});
    const cloned = {} as T;
    const objRecord = obj as Record<string, unknown>;

    for (const key in objRecord) {
      if (Object.hasOwn(objRecord, key)) {
        const value = objRecord[key];

        // Skip undefined (JSON.stringify behavior)
        if (value === undefined) {
          continue;
        }

        try {
          (cloned as Record<string, unknown>)[key] = deepClone(value, visited);
        } catch (error) {
          visited.delete(obj);
          // If we hit a circular reference or other issue, throw with context
          throw new Error(
            `Failed to deep clone object: ${error instanceof Error ? error.message : String(error)} at key "${key}"`,
          );
        }
      }
    }

    visited.delete(obj);
    return cloned;
  }

  // Handle functions - return as-is (can't clone functions)
  if (typeof obj === 'function') {
    return obj;
  }

  // Handle symbols - return as-is (symbols are unique by design)
  if (typeof obj === 'symbol') {
    return obj;
  }

  // Fallback for other types
  return obj;
}
