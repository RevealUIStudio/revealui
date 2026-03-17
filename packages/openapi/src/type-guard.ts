/**
 * Checks if a value is a Zod schema by duck-typing its core methods.
 */
export function isZod(x: unknown): boolean {
  if (!x) return false;
  if (typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.parse === 'function' &&
    typeof obj.safeParse === 'function' &&
    typeof obj.parseAsync === 'function' &&
    typeof obj.safeParseAsync === 'function'
  );
}

/**
 * Checks if a content type string represents JSON.
 * Matches: application/json, application/vnd.api+json, etc.
 */
export function isJSONContentType(contentType: string): boolean {
  return /^application\/([a-z-.]+\+)?json/.test(contentType);
}

/**
 * Checks if a content type string represents form data.
 * Matches: multipart/form-data, application/x-www-form-urlencoded
 */
export function isFormContentType(contentType: string): boolean {
  return (
    contentType.startsWith('multipart/form-data') ||
    contentType.startsWith('application/x-www-form-urlencoded')
  );
}
