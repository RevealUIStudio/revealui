/**
 * Small, dependency-free helpers for reading typed fields off an untrusted
 * `unknown` hook payload. No `regex`, no `any` -- every editor's hook JSON
 * is external input (design doc trust boundary: every editor client is
 * untrusted), so every field read here is a runtime-checked narrowing, never
 * a cast.
 */

/** Narrow an unknown value to a plain object, or `{}` if it isn't one. */
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Read a string field, or `undefined` if absent/wrong type/empty. */
export function readString(rec: Record<string, unknown>, key: string): string | undefined {
  const value = rec[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Read an array-of-strings field, or `undefined` if absent/empty/wrong type. */
export function readStringArray(rec: Record<string, unknown>, key: string): string[] | undefined {
  const value = rec[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  return strings.length > 0 ? strings : undefined;
}
