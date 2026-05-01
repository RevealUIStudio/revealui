/**
 * Slug derivation for docs URL flatten (chip 3 / GAP unfiled).
 *
 * Per CHIP-3 plan D2b: lowercase-kebab slug normalization on docs URLs.
 * Filenames in suite-root `docs/` use a mix of conventions:
 *   - SCREAMING_SNAKE: ADMIN_GUIDE.md, QUICK_START.md
 *   - kebab-case: 02-x402-payments.md, agent-rules/test-prompts.md
 *   - mixed (rare): RevealUIDocs.md (none today, but the regex handles it)
 *
 * The slug derivation produces a single canonical lowercase-kebab form
 * for every filename, preserving directory structure for nested files.
 * The companion slug-manifest.ts maps each slug back to its original
 * file path so the markdown resolver can fetch the right .md.
 *
 * Round-trip is one-way: filename → slug is deterministic; slug → filename
 * requires the manifest lookup (information loss in the lowercase + dash
 * collapse means we cannot reverse the regex).
 */

/**
 * Convert a filename (with or without `.md` extension) to its
 * canonical lowercase-kebab slug.
 *
 * Examples:
 *   ADMIN_GUIDE.md         → admin-guide
 *   QUICK_START            → quick-start
 *   02-x402-payments.md    → 02-x402-payments
 *   RevealUIDocs.md        → reveal-ui-docs
 */
export function filenameToSlug(filename: string): string {
  return filename
    .replace(/\.md$/, '')
    .replace(/_/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert a docs-relative file path to its slug, preserving directory
 * structure. Only the filename component is normalized; intermediate
 * directories pass through (already-kebab-case by convention).
 *
 * Examples:
 *   ADMIN_GUIDE.md                     → admin-guide
 *   blog/02-x402-payments.md           → blog/02-x402-payments
 *   suite/revvault.md                  → suite/revvault
 *   ai/PROMPT_CACHING.md               → ai/prompt-caching
 */
export function pathToSlug(relPath: string): string {
  const parts = relPath.split('/');
  const filename = parts.pop();
  if (!filename) return '';
  const slug = filenameToSlug(filename);
  return parts.length > 0 ? `${parts.join('/')}/${slug}` : slug;
}
