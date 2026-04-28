/**
 * Startup state flags  -  shared between index.ts and health routes.
 * Extracted to avoid circular imports (health.ts ↔ index.ts).
 */

/** Set to true when CORS_ORIGIN is missing in production */
export let corsConfigMissing = false;

export function setCorsConfigMissing(value: boolean): void {
  corsConfigMissing = value;
}
