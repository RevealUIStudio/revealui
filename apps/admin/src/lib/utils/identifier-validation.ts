/**
 * Identifier validation helpers for the sync/shape API routes.
 *
 * Character-set predicates (no authored regex, per the no-regex posture).
 */

const UUID_SEGMENTS = [8, 4, 4, 4, 12] as const;
const HEX_CHARS = new Set('0123456789abcdef');

/** RFC 4122 textual UUID shape (case-insensitive). */
export function isUuid(value: string): boolean {
  if (value.length !== 36) return false;
  const parts = value.toLowerCase().split('-');
  if (parts.length !== UUID_SEGMENTS.length) return false;
  return UUID_SEGMENTS.every((len, i) => {
    const part = parts[i];
    return (
      part !== undefined && part.length === len && Array.from(part).every((c) => HEX_CHARS.has(c))
    );
  });
}

const IDENTIFIER_CHARS = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
);

/**
 * Sync identifier: non-empty, alphanumeric plus hyphen/underscore. Covers the
 * id formats used across sync collections (agent ids, coordination session
 * and work-item ids, UUIDs, and prefixed ids like the revmarket task ids).
 */
export function isSyncIdentifier(value: string): boolean {
  return value.length > 0 && Array.from(value).every((c) => IDENTIFIER_CHARS.has(c));
}

const REPO_IDENTIFIER_CHARS = new Set(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.',
);
const MAX_REPO_IDENTIFIER_LENGTH = 128;

/**
 * Fleet repo identifier: non-empty, alphanumeric plus hyphen/underscore/dot,
 * bounded length. Superset of {@link isSyncIdentifier}'s charset (adds `.`)
 * to cover repo names like `.jv`. Used to validate the `repo` denormalized
 * partition column (design spec §8.2) before it is inlined into an Electric
 * shape `where` clause — never accept an unvalidated value there.
 */
export function isRepoIdentifier(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_REPO_IDENTIFIER_LENGTH &&
    Array.from(value).every((c) => REPO_IDENTIFIER_CHARS.has(c))
  );
}
