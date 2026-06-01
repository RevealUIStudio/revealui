/**
 * Slug derivation for docs URL flatten (chip 3 / GAP unfiled).
 *
 * Per CHIP-3 plan D2b: lowercase-kebab slug normalization on docs URLs.
 * Filenames in fleet-root `docs/` use a mix of conventions:
 *   - SCREAMING_SNAKE: ADMIN_GUIDE.md, QUICK_START.md
 *   - kebab-case: 02-x402-payments.md, agent-rules/test-prompts.md
 *   - mixed (rare): RevealUIDocs.md (none today, but the slug algorithm handles it)
 *
 * The slug derivation produces a single canonical lowercase-kebab form
 * for every filename, preserving directory structure for nested files.
 * The companion slug-manifest.ts maps each slug back to its original
 * file path so the markdown resolver can fetch the right .md.
 *
 * Round-trip is one-way: filename → slug is deterministic; slug → filename
 * requires the manifest lookup (information loss in the lowercase + dash
 * collapse means we cannot reverse the derivation).
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
const isAsciiUpper = (ch: string | undefined): boolean =>
  ch !== undefined && ch >= 'A' && ch <= 'Z';
const isAsciiLower = (ch: string | undefined): boolean =>
  ch !== undefined && ch >= 'a' && ch <= 'z';

export function filenameToSlug(filename: string): string {
  // Drop a trailing `.md` extension (only `.md`, matching the prior behavior).
  const base = filename.endsWith('.md') ? filename.slice(0, -3) : filename;

  // Single pass: map `_` to `-` and insert `-` at word boundaries —
  //   lower->Upper ("aB" -> "a-B") and acronym->word ("HTMLParser" -> "HTML-Parser").
  let dashed = '';
  for (let i = 0; i < base.length; i++) {
    const ch = base[i];
    if (ch === '_') {
      dashed += '-';
      continue;
    }
    const prev = i > 0 ? base[i - 1] : '';
    const next = i + 1 < base.length ? base[i + 1] : '';
    const lowerToUpper = isAsciiUpper(ch) && isAsciiLower(prev);
    const acronymToWord = isAsciiUpper(ch) && isAsciiUpper(prev) && isAsciiLower(next);
    if (lowerToUpper || acronymToWord) {
      dashed += '-';
    }
    dashed += ch;
  }

  // Lowercase, collapse runs of `-`, and trim a leading/trailing `-`.
  const lowered = dashed.toLowerCase();
  let collapsed = '';
  let prevDash = false;
  for (const ch of lowered) {
    if (ch === '-') {
      if (!prevDash) {
        collapsed += '-';
      }
      prevDash = true;
    } else {
      collapsed += ch;
      prevDash = false;
    }
  }
  let start = 0;
  let end = collapsed.length;
  if (start < end && collapsed[start] === '-') start++;
  if (end > start && collapsed[end - 1] === '-') end--;
  return collapsed.slice(start, end);
}

/**
 * Convert a docs-relative file path to its slug, preserving directory
 * structure. Only the filename component is normalized; intermediate
 * directories pass through (already-kebab-case by convention).
 *
 * Examples:
 *   ADMIN_GUIDE.md                     → admin-guide
 *   blog/02-x402-payments.md           → blog/02-x402-payments
 *   fleet/revvault.md                  → fleet/revvault
 *   ai/PROMPT_CACHING.md               → ai/prompt-caching
 */
export function pathToSlug(relPath: string): string {
  const parts = relPath.split('/');
  const filename = parts.pop();
  if (!filename) return '';
  const slug = filenameToSlug(filename);
  return parts.length > 0 ? `${parts.join('/')}/${slug}` : slug;
}
