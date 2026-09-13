/**
 * Literal, normalized phrase matching. No regex (fleet M2).
 */

export function normalizePhrase(value: string): string {
  let out = '';
  let pendingSpace = false;
  for (const ch of value.toLowerCase()) {
    const code = ch.charCodeAt(0);
    const isSpace = ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
    if (isSpace) {
      pendingSpace = out.length > 0;
      continue;
    }
    const isLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (isLetter || isDigit || ch === "'" || ch === '-' || ch === '_' || ch === '.' || ch === '/') {
      if (pendingSpace) {
        out += ' ';
        pendingSpace = false;
      }
      out += ch;
    } else {
      pendingSpace = out.length > 0;
    }
  }
  return out;
}

export function containsPhrase(haystack: string, needle: string): boolean {
  const normalizedHay = normalizePhrase(haystack);
  const normalizedNeedle = normalizePhrase(needle);
  if (normalizedNeedle.length === 0) {
    return false;
  }
  return normalizedHay.includes(normalizedNeedle);
}

export function firstMatchingPhrase(haystack: string, phrases: readonly string[]): string | null {
  for (const phrase of phrases) {
    if (containsPhrase(haystack, phrase)) {
      return phrase;
    }
  }
  return null;
}
