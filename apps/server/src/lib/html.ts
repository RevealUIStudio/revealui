/**
 * Shared HTML helpers for server-built HTML (email templates, auth pages).
 */

/**
 * No-regex HTML escape (per the fleet no-authored-regex rule).
 *
 * Replaces the five HTML special characters. `&` must stay first so the
 * `&` introduced by the later replacements is not itself re-escaped.
 *
 * Narrower than `escapeHtml` in `@revealui/core` (renderPage), which also
 * escapes `/` and emits `&#x27;` for apostrophes — keep them distinct.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
