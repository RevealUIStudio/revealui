/**
 * Runtime type guards and assertion helpers for API routes.
 *
 * Replaces `as unknown as T` double casts with safer alternatives.
 */

/**
 * Asserts that a readonly string tuple is non-empty and returns it as a
 * mutable `[string, ...string[]]` suitable for `z.enum()`.
 *
 * This avoids the `as unknown as [string, ...string[]]` double cast
 * that every route file was using to bridge `readonly` const arrays
 * into Zod's mutable enum signature.
 */
export function asNonEmptyTuple<T extends string>(values: readonly T[]): [T, ...T[]] {
  if (values.length === 0) {
    throw new Error('Expected a non-empty array for z.enum()');
  }
  return values as unknown as [T, ...T[]];
}

/**
 * Safely reads a dynamic field from a Stripe object.
 *
 * Stripe's TypeScript types sometimes lag behind the actual API shape,
 * so we use runtime validation instead of a double cast.
 */
export function getStripeField<T>(
  obj: Record<string, unknown> | object,
  field: string,
): T | undefined {
  if (obj !== null && typeof obj === 'object' && field in obj) {
    return (obj as Record<string, unknown>)[field] as T;
  }
  return undefined;
}
