/**
 * Shared date serialization helpers for API route handlers.
 *
 * Drizzle returns timestamp columns as Date objects, but OpenAPI schemas
 * expect ISO 8601 strings. These helpers handle both Date and string inputs
 * to support test mocks that may pass strings directly.
 */

export function dateToString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function nullableDateToString(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}
