/**
 * SQL-injection attack corpus for `escapeSqlIdentifier`.
 *
 * Focused on the *identifier* sink — table/column/schema names flowing
 * through runtime interpolation. Literal-value injection is a separate
 * problem solved by parameterised queries (`$1`, `$2`, …) and is not
 * in scope here.
 *
 * Each vector either: (a) is a legal-but-evil identifier that must be
 * safely quoted, or (b) is malformed in a way we want to reject with
 * a thrown error rather than silently corrupt.
 */

export interface DangerousIdentifierVector {
  input: string;
  /** `throws` = reject with error. `quotes` = accept but must quote-escape. */
  mode: 'throws' | 'quotes';
  rationale: string;
}

export const DANGEROUS_IDENTIFIER_VECTORS: readonly DangerousIdentifierVector[] = [
  {
    input: '"; DROP TABLE users; --',
    mode: 'quotes',
    rationale: 'classic SQL injection — must be neutralised by doubling the leading "',
  },
  {
    input: 'users"; DELETE FROM posts; --',
    mode: 'quotes',
    rationale: 'embedded close-quote + statement break — " must be doubled',
  },
  {
    input: 'a"b"c',
    mode: 'quotes',
    rationale: 'multiple embedded quotes — all must be doubled',
  },
  {
    input: '"',
    mode: 'quotes',
    rationale: 'identifier is a single bare quote — becomes ""',
  },
  {
    input: '""""',
    mode: 'quotes',
    rationale: 'repeated quotes — each doubles, even number stays even',
  },
  {
    input: "name'; DROP TABLE",
    mode: 'quotes',
    rationale: 'single-quote is harmless inside a double-quoted identifier — no escape needed',
  },
  {
    input: 'name; SELECT 1',
    mode: 'quotes',
    rationale: 'semicolon is harmless inside double-quoted identifier',
  },
  {
    input: 'name--comment',
    mode: 'quotes',
    rationale: 'SQL comment syntax inert inside double-quoted identifier',
  },
  {
    input: 'name/*evil*/',
    mode: 'quotes',
    rationale: 'block comment inert inside double-quoted identifier',
  },
  {
    input: '',
    mode: 'throws',
    rationale: 'empty identifier — reject rather than emit `""`',
  },
  {
    input: 'name\x00evil',
    mode: 'throws',
    rationale: 'NUL byte — Postgres cannot store it, drivers truncate silently',
  },
  {
    input: '\x00',
    mode: 'throws',
    rationale: 'pure NUL — must reject',
  },
  {
    input: 'a'.repeat(64),
    mode: 'throws',
    rationale: '64 bytes exceeds NAMEDATALEN-1 (63) — Postgres would truncate',
  },
  {
    // 21 × 3-byte UTF-8 chars = 63 bytes exactly → allowed.
    // 22 × 3-byte = 66 bytes → reject.
    input: '日'.repeat(22),
    mode: 'throws',
    rationale: 'UTF-8 byte length, not character length, is what matters',
  },
];

export const SAFE_IDENTIFIER_VECTORS: readonly string[] = [
  'users',
  'user_profiles',
  'UserProfiles',
  '_private',
  'a',
  't1',
  'a'.repeat(63),
  // Reserved word — legal as quoted identifier.
  'select',
  'from',
  'table',
  // Non-ASCII identifiers are legal in Postgres when quoted.
  'café',
  '日本',
  // Trailing/leading whitespace is valid inside a quoted identifier.
  '  padded  ',
] as const;
