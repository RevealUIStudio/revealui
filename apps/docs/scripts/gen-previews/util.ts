import { createHash } from 'node:crypto';

function isUpper(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z';
}

function isLower(ch: string): boolean {
  return ch >= 'a' && ch <= 'z';
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/**
 * PascalCase / camelCase export name → kebab-case file slug.
 * Char-scan (no authored regex, per fleet M2): a dash is inserted before an
 * uppercase letter that either follows a lowercase/digit, or starts a new word
 * inside an acronym run (uppercase followed by lowercase). e.g. RevealUIMark →
 * reveal-ui-mark, ButtonCVA → button-cva.
 */
export function kebabCase(name: string): string {
  const out: string[] = [];
  for (let i = 0; i < name.length; i++) {
    const ch = name[i] as string;
    if (isUpper(ch) && i > 0) {
      const prev = name[i - 1] as string;
      const next = i + 1 < name.length ? (name[i + 1] as string) : '';
      const boundary = isLower(prev) || isDigit(prev) || (isUpper(prev) && isLower(next));
      if (boundary) out.push('-');
    }
    out.push(ch.toLowerCase());
  }
  return out.join('');
}

export function isPascalCase(name: string): boolean {
  return name.length > 0 && isUpper(name[0] as string);
}

export function escapeHtml(value: string): string {
  return value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;');
}

/** Escape a value for use inside an HTML comment (dsCard marker). */
export function escapeComment(value: string): string {
  return value.split('--').join('––').split('\r').join(' ').split('\n').join(' ').trim();
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Deterministic PRNG (mulberry32) used to replace Math.random during render. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
