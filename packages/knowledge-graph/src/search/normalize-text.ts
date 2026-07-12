/**
 * Character-walk text normalizer for FTS indexing (GAP-349).
 *
 * Postgres's `english` tsvector parser tokenizes path-like and hyphenated
 * strings as a single "file"/"host" token — `electric-proxy.ts` and
 * `apps/admin/src/lib/api/electric-proxy.ts` each become one opaque token —
 * so word-level queries like "electric proxy" never match via
 * `websearch_to_tsquery`. This walker produces a word-segmented rendering by
 * turning separator characters (`/ - _ .`) into spaces and inserting a space
 * at camelCase boundaries (lower/digit → upper, and the acronym→word
 * boundary upper,upper→lower, e.g. `HTTPServer` → `HTTP Server`).
 *
 * No regex, per the fleet no-regex rule — pure character-code walk.
 */

const SEPARATORS = new Set(['/', '-', '_', '.']);

function isUpper(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z';
}

function isLower(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/** Collapse runs of ASCII spaces into single spaces and trim. Regex-free. */
function collapseSpaces(input: string): string {
  const words: string[] = [];
  let cur = '';
  for (const ch of input) {
    if (ch === ' ') {
      if (cur) {
        words.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) words.push(cur);
  return words.join(' ');
}

/**
 * Word-segment a single identifier/path-like string: separators become
 * spaces and camelCase boundaries get a space inserted before the boundary
 * character. Case is preserved (the tsvector parser lowercases downstream).
 */
export function segmentWords(input: string): string {
  const chars = [...input];
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === undefined) continue;
    if (SEPARATORS.has(ch)) {
      out.push(' ');
      continue;
    }
    const prev = chars[i - 1];
    if (isUpper(ch) && prev !== undefined) {
      const lowerOrDigitToUpper = isLower(prev) || isDigit(prev);
      const next = chars[i + 1];
      const acronymToWord = isUpper(prev) && next !== undefined && isLower(next);
      if (lowerOrDigitToUpper || acronymToWord) {
        out.push(' ');
      }
    }
    out.push(ch);
  }
  return collapseSpaces(out.join(''));
}

/**
 * Build the `search_text` value for a `kg_nodes` row: the original `name`
 * (unnormalized, so an exact single-token query like `electric-proxy.ts`
 * still hits) plus word-segmented renderings of `name`, `naturalKey`, and
 * `summary` (when present), so word-level queries like "electric proxy" or
 * "pool stats" match too.
 */
export function buildSearchText(
  name: string,
  naturalKey: string,
  summary: string | null | undefined,
): string {
  const parts = [name, segmentWords(name), segmentWords(naturalKey)];
  if (summary) parts.push(segmentWords(summary));
  return collapseSpaces(parts.join(' '));
}
