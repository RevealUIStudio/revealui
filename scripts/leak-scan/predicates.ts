// No-regex matching primitives for the leak scanner.
//
// Per the fleet zero-regex hardline (M2 / feedback_no_regex_ast_only): every
// rule is expressed with a literal substring check or a small typed segment
// matcher over code points. No RegExp is constructed anywhere in this tool.

/** A character-class predicate over a single character. */
export type CharClass = (ch: string) => boolean;

export const isLower: CharClass = (c) => c >= 'a' && c <= 'z';
export const isUpper: CharClass = (c) => c >= 'A' && c <= 'Z';
export const isDigit: CharClass = (c) => c >= '0' && c <= '9';
export const isHexLower: CharClass = (c) => isDigit(c) || (c >= 'a' && c <= 'f');
export const isAlnum: CharClass = (c) => isLower(c) || isUpper(c) || isDigit(c);
/** [a-z0-9_-] — unix username body. */
export const isLowerNameChar: CharClass = (c) => isLower(c) || isDigit(c) || c === '_' || c === '-';
/** [A-Za-z0-9_-] — Windows username body. */
export const isNameChar: CharClass = (c) => isAlnum(c) || c === '_' || c === '-';
/** Path separator: backslash or forward slash. */
export const isPathSep: CharClass = (c) => c === '\\' || c === '/';

/**
 * A pattern segment: either a fixed literal, or a run of `min`..`max`
 * (max omitted = unbounded) consecutive characters all satisfying `cls`.
 */
export type Segment =
  | { readonly kind: 'literal'; readonly value: string }
  | {
      readonly kind: 'class';
      readonly cls: CharClass;
      readonly min: number;
      readonly max?: number;
    };

export const lit = (value: string): Segment => ({ kind: 'literal', value });
export const run = (cls: CharClass, min: number, max?: number): Segment => ({
  kind: 'class',
  cls,
  min,
  max,
});

/**
 * Try to match `segments` in order, anchored at index `start`. Class runs are
 * greedy with no backtracking — sufficient and intentional, because every rule
 * keeps each class run either terminal or followed by a literal whose first
 * character is OUTSIDE the run's class, so greedy never over-eats a character a
 * later literal needs. Returns the end index, or -1 on no match.
 */
function matchAt(s: string, start: number, segments: readonly Segment[]): number {
  let i = start;
  for (const seg of segments) {
    if (seg.kind === 'literal') {
      if (!s.startsWith(seg.value, i)) return -1;
      i += seg.value.length;
    } else {
      const cap = seg.max ?? Number.POSITIVE_INFINITY;
      let count = 0;
      while (i < s.length && count < cap && seg.cls(s[i] as string)) {
        i += 1;
        count += 1;
      }
      if (count < seg.min) return -1;
    }
  }
  return i;
}

/** True if `segments` match starting at some index in `s`. */
export function containsPattern(s: string, segments: readonly Segment[]): boolean {
  for (let i = 0; i < s.length; i += 1) {
    if (matchAt(s, i, segments) !== -1) return true;
  }
  return false;
}

/** True if `s` contains `value` as a literal substring. */
export function literalIncludes(s: string, value: string): boolean {
  return s.includes(value);
}
