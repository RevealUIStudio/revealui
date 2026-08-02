/**
 * Extract customer-facing prose units from a blog markdown body (GAP-467).
 * Zero authored regex: line-state machine only (fleet no-regex hardline).
 *
 * Spec: .jv docs/specs/2026-08-02-blog-claims-evidence.md
 */

const MIN_PROSE_LENGTH = 26;
const FENCE = '```';

function isProseUnit(value: string): boolean {
  if (value.length < MIN_PROSE_LENGTH) return false;
  if (!value.includes(' ')) return false;
  if (value.startsWith('http') || value.startsWith('/')) return false;
  return true;
}

/** Strip leading markdown heading markers (# …) and list markers. */
function stripLineDecorators(line: string): string {
  let t = line.trim();
  // Headings: one or more # then space
  while (t.startsWith('#')) {
    t = t.slice(1);
  }
  t = t.trimStart();
  // Unordered list
  if (t.startsWith('- ') || t.startsWith('* ') || t.startsWith('+ ')) {
    t = t.slice(2);
  } else {
    // Ordered list: digits then . then space
    let i = 0;
    while (i < t.length && t[i] >= '0' && t[i] <= '9') i += 1;
    if (i > 0 && t[i] === '.' && t[i + 1] === ' ') {
      t = t.slice(i + 2);
    }
  }
  // Blockquote
  if (t.startsWith('> ')) t = t.slice(2);
  else if (t === '>') t = '';
  return t.trim();
}

/**
 * Split markdown into prose units (paragraphs + list items / headings that
 * pass the prose predicates). Fenced code blocks are skipped entirely.
 */
export function extractBlogMdProseUnits(markdown: string): string[] {
  const lines = markdown.split('\n');
  const units: string[] = [];
  let inFence = false;
  let para: string[] = [];

  const flushPara = (): void => {
    if (para.length === 0) return;
    const joined = para.join(' ').replace(/\s+/g, ' ').trim();
    para = [];
    if (isProseUnit(joined)) units.push(joined);
  };

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.startsWith(FENCE)) {
      flushPara();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (trimmed.length === 0) {
      flushPara();
      continue;
    }

    // Horizontal rules and pure link definitions are not prose.
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushPara();
      continue;
    }

    const cleaned = stripLineDecorators(raw);
    if (cleaned.length === 0) continue;

    // List items and headings: own unit when they qualify as prose alone;
    // otherwise fold into paragraph flow.
    const isListOrHeading =
      raw.trimStart().startsWith('#') ||
      raw.trimStart().startsWith('- ') ||
      raw.trimStart().startsWith('* ') ||
      raw.trimStart().startsWith('+ ') ||
      (() => {
        const t = raw.trimStart();
        let i = 0;
        while (i < t.length && t[i] >= '0' && t[i] <= '9') i += 1;
        return i > 0 && t[i] === '.' && t[i + 1] === ' ';
      })() ||
      raw.trimStart().startsWith('> ');

    if (isListOrHeading) {
      flushPara();
      if (isProseUnit(cleaned)) units.push(cleaned);
      continue;
    }

    para.push(cleaned);
  }
  flushPara();

  // Dedupe exact repeats (e.g. repeated nav chrome) while preserving order.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of units) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}
