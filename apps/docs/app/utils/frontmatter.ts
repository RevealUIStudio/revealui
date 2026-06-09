/**
 * RevealUI-native frontmatter parser for documentation markdown.
 *
 * Hand-rolled, zero authored regex (fleet no-regex hardline, M2) — a
 * line-oriented character scanner in the same idiom as the syntax highlighter
 * in ./markdown.tsx. It strips a leading metadata block so the block never
 * reaches the renderer, while leaving it physically in the source file for
 * agents and humans reading the raw markdown.
 *
 * Two block delimiters, chosen per file:
 *
 *   ---                       Fenced YAML-style block. Conventional; note that
 *   title: Hello              GitHub renders this as a metadata *table*, so it
 *   ---                       stays visible there.
 *
 *   <!-- title: Hello -->     HTML-comment block. Dropped by the docs renderer
 *                             AND by GitHub, so it is invisible on both — use
 *                             this for files read on both surfaces (e.g. READMEs).
 *
 * Inside a block, each non-blank line is `key: value`; lines beginning with `#`
 * are comments. Values are typed:
 *
 *   string    bare text  |  "double-quoted"  |  'single-quoted'
 *   number    42  |  -3.14  |  6.022e23
 *   boolean   true  |  false
 *   null      null  |  ~  |  (empty)
 *   array     [a, "b, c", 3]            scalars only, quote-aware
 *
 * Nested maps and multiline scalars are intentionally unsupported — frontmatter
 * that needs them is a smell; promote it to a real data file instead.
 *
 * Safety: a block is treated as frontmatter only when it is non-empty, has a
 * closing delimiter, AND every non-blank, non-comment line is `key:`-shaped.
 * So a document that merely opens with a `---` horizontal rule, or an arbitrary
 * inline string passed to renderMarkdown, is never mistaken for frontmatter and
 * silently eaten.
 */

export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterValue = FrontmatterScalar | FrontmatterScalar[];
export type FrontmatterData = Record<string, FrontmatterValue>;

export interface ParsedFrontmatter {
  /** Parsed metadata. Empty object when the source has no frontmatter block. */
  data: FrontmatterData;
  /** The document body with the frontmatter block removed. */
  body: string;
}

const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';

// — character predicates (no regex; mirror ./markdown.tsx) ———————————————————
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isLower = (c: string | undefined): boolean => c !== undefined && c >= 'a' && c <= 'z';
const isUpper = (c: string | undefined): boolean => c !== undefined && c >= 'A' && c <= 'Z';
const isSpace = (c: string | undefined): boolean => c === ' ' || c === '\t';
/** Key chars: letters, digits, underscore, hyphen (lower-kebab / snake keys). */
const isKeyChar = (c: string | undefined): boolean =>
  isLower(c) || isUpper(c) || isDigit(c) || c === '_' || c === '-';

/**
 * Parse the leading frontmatter block (if any) out of a markdown source.
 * Total — never throws; returns the original text as `body` when there is no
 * well-formed block, so callers can render unconditionally.
 */
export function parseFrontmatter(input: string): ParsedFrontmatter {
  const lines = toLines(input);
  const first = (lines[0] ?? '').trim();

  if (first === '---') {
    return extractFenced(lines, input);
  }
  if (first.startsWith(COMMENT_OPEN)) {
    return extractComment(lines, input);
  }
  return { data: {}, body: input };
}

/** Split into lines, stripping a leading BOM and trailing CR (CRLF tolerance).
 *  Uses String.split with a literal newline — not a regex. */
function toLines(input: string): string[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  return text.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

function extractFenced(lines: string[], original: string): ParsedFrontmatter {
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').trim() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { data: {}, body: original }; // unterminated → not frontmatter
  }
  const block = lines.slice(1, closeIdx);
  if (!isFrontmatterShaped(block)) {
    return { data: {}, body: original }; // e.g. a leading horizontal rule
  }
  const body = dropLeadingBlank(lines.slice(closeIdx + 1)).join('\n');
  return { data: parseKeyValues(block), body };
}

function extractComment(lines: string[], original: string): ParsedFrontmatter {
  let closeIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if ((lines[i] ?? '').includes(COMMENT_CLOSE)) {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { data: {}, body: original };
  }

  const block: string[] = [];
  let trailing = '';
  for (let i = 0; i <= closeIdx; i += 1) {
    let line = lines[i] ?? '';
    if (i === 0) {
      line = line.slice(line.indexOf(COMMENT_OPEN) + COMMENT_OPEN.length);
    }
    if (i === closeIdx) {
      const end = line.indexOf(COMMENT_CLOSE);
      trailing = line.slice(end + COMMENT_CLOSE.length);
      line = line.slice(0, end);
    }
    block.push(line);
  }

  if (!isFrontmatterShaped(block)) {
    return { data: {}, body: original };
  }

  const rest = lines.slice(closeIdx + 1);
  const bodyLines = trailing.trim().length > 0 ? [trailing, ...rest] : dropLeadingBlank(rest);
  return { data: parseKeyValues(block), body: bodyLines.join('\n') };
}

/** True when every non-blank, non-comment line is a `key:` pair and at least
 *  one such pair exists. Guards against eating leading horizontal rules. */
function isFrontmatterShaped(lines: string[]): boolean {
  let keyLines = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    if (findSeparator(line) === -1) {
      return false;
    }
    keyLines += 1;
  }
  return keyLines > 0;
}

function parseKeyValues(lines: string[]): FrontmatterData {
  const data: FrontmatterData = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const sep = findSeparator(line);
    if (sep === -1) {
      continue;
    }
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (key.length > 0) {
      data[key] = parseValue(value);
    }
  }
  return data;
}

/** Index of the `key: value` colon, scanning the key as identifier chars so a
 *  colon inside the value (e.g. a URL) is not mistaken for the separator. */
function findSeparator(line: string): number {
  let i = 0;
  while (isKeyChar(line[i])) {
    i += 1;
  }
  if (i === 0) {
    return -1;
  }
  let j = i;
  while (isSpace(line[j])) {
    j += 1;
  }
  return line[j] === ':' ? j : -1;
}

function dropLeadingBlank(lines: string[]): string[] {
  return lines.length > 0 && (lines[0] ?? '').trim() === '' ? lines.slice(1) : lines;
}

function parseValue(value: string): FrontmatterValue {
  if (value === '' || value === 'null' || value === '~') {
    return null;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const first = value[0];
  if (first === '"' || first === "'") {
    return unquote(value);
  }
  if (first === '[') {
    return parseArray(value);
  }
  if (isNumber(value)) {
    return Number(value);
  }
  return value;
}

/** Whole-string numeric check: optional sign, digits, optional fraction,
 *  optional exponent — and nothing else. */
function isNumber(s: string): boolean {
  let i = 0;
  if (s[i] === '+' || s[i] === '-') {
    i += 1;
  }
  let digits = 0;
  while (isDigit(s[i])) {
    i += 1;
    digits += 1;
  }
  if (s[i] === '.') {
    i += 1;
    while (isDigit(s[i])) {
      i += 1;
      digits += 1;
    }
  }
  if (digits === 0) {
    return false;
  }
  if (s[i] === 'e' || s[i] === 'E') {
    i += 1;
    if (s[i] === '+' || s[i] === '-') {
      i += 1;
    }
    let exp = 0;
    while (isDigit(s[i])) {
      i += 1;
      exp += 1;
    }
    if (exp === 0) {
      return false;
    }
  }
  return i === s.length;
}

/** Strip matching surrounding quotes, honoring `\n`, `\t`, and `\<char>`. */
function unquote(value: string): string {
  const quote = value[0];
  let out = '';
  let i = 1;
  while (i < value.length) {
    const c = value[i];
    if (c === '\\') {
      const next = value[i + 1] ?? '';
      if (next === 'n') {
        out += '\n';
      } else if (next === 't') {
        out += '\t';
      } else {
        out += next;
      }
      i += 2;
      continue;
    }
    if (c === quote) {
      break;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Parse an inline `[a, "b, c", 3]` array into scalars, respecting quotes so a
 *  comma inside a quoted item does not split it. */
function parseArray(value: string): FrontmatterScalar[] {
  const items: FrontmatterScalar[] = [];
  let token = '';
  const flush = (): void => {
    const trimmed = token.trim();
    token = '';
    if (trimmed === '') {
      return;
    }
    const parsed = parseValue(trimmed);
    items.push(Array.isArray(parsed) ? null : parsed); // arrays hold scalars only
  };

  let i = 1; // skip the opening '['
  while (i < value.length) {
    const c = value[i];
    if (c === ']') {
      break;
    }
    if (c === '"' || c === "'") {
      const end = scanStringEnd(value, i);
      token += value.slice(i, end);
      i = end;
      continue;
    }
    if (c === ',') {
      flush();
      i += 1;
      continue;
    }
    token += c;
    i += 1;
  }
  flush();
  return items;
}

/** Index just past the closing quote of the string starting at `start`. */
function scanStringEnd(s: string, start: number): number {
  const quote = s[start];
  let i = start + 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) {
      return i + 1;
    }
    i += 1;
  }
  return i;
}
