/**
 * Centralized API URL resolution.
 *
 * Eliminates the 25+ inline `process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com'`
 * duplicates scattered across the CMS codebase.
 */

const DEFAULT_API_URL = 'https://api.revealui.com';

/**
 * Get the external RevealUI API base URL (no trailing slash).
 *
 * Resolution order:
 * 1. `NEXT_PUBLIC_API_URL` (browser-safe, primary)
 * 2. Falls back to `https://api.revealui.com`
 *
 * Use this for client-side and server-side calls to the RevealUI API.
 */
export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  return url || DEFAULT_API_URL;
}

/**
 * Get the content API URL for server-side proxy routes.
 *
 * Resolution order:
 * 1. `NEXT_PUBLIC_API_URL`
 * 2. `REVEALUI_PUBLIC_SERVER_URL`
 *
 * Throws if neither is configured — prevents silent fallback to localhost
 * which would break production.
 */
export function getContentApiUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.REVEALUI_PUBLIC_SERVER_URL?.trim();

  if (!url) {
    throw new Error(
      'Content API URL not configured. Set NEXT_PUBLIC_API_URL or REVEALUI_PUBLIC_SERVER_URL.',
    );
  }

  return url;
}
