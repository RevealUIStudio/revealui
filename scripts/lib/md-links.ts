/**
 * Zero-regex markdown extractors shared by root-level doc validators.
 *
 * No authored regex (fleet M2 hardline): all parsing is `indexOf` / `split`
 * scans. Fenced code blocks (``` / ~~~) are skipped so example syntax written
 * inside them is never treated as a real link or citation.
 *
 * Lifted + generalized from `apps/docs/scripts/check-links.ts`
 * (`extractLinkTargets` + `stripInlineCode`) for the source-citation gate
 * (`scripts/validate/citation-check.ts`): line numbers are tracked, and
 * inline-code spans are extractable (citations are commonly authored as
 * `` `packages/core/src/license.ts:96-119` ``). `check-links.ts` keeps its own
 * copy for now; converging it onto this module is a tracked follow-up.
 */

export interface LineRef {
  /** 1-indexed source line where the text was found. */
  line: number;
  /** The extracted text — a link target or an inline-code span's contents. */
  text: string;
}

/**
 * Blank out single-backtick inline-code spans so example link syntax written
 * inside `...` is not mistaken for a real link. Splitting on backticks, the
 * even-index segments are outside code and the odd-index segments are inside.
 */
export function stripInlineCode(line: string): string {
  if (!line.includes('`')) {
    return line;
  }
  const parts = line.split('`');
  let out = '';
  let insideCode = false;
  for (const part of parts) {
    out += insideCode ? ' ' : part;
    insideCode = !insideCode;
  }
  return out;
}

/** True when a left-trimmed line opens or closes a fenced code block. */
function isFenceMarker(trimmed: string): boolean {
  return trimmed.startsWith('```') || trimmed.startsWith('~~~');
}

/**
 * Walk markdown lines, skipping fenced code blocks, invoking `onLine` with each
 * prose line (1-indexed) that lies outside a fence.
 */
export function forEachProseLine(
  markdown: string,
  onLine: (rawLine: string, lineNo: number) => void,
): void {
  let inFence = false;
  let fence = '';
  const lines = markdown.split('\n');
  // Skip a leading YAML frontmatter block (--- … ---) — metadata, not prose.
  let start = 0;
  if (lines.length > 0 && lines[0].trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        start = i + 1;
        break;
      }
    }
  }
  for (let i = start; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trimStart();
    if (isFenceMarker(trimmed)) {
      const marker = trimmed.slice(0, 3);
      if (!inFence) {
        inFence = true;
        fence = marker;
      } else if (trimmed.startsWith(fence)) {
        inFence = false;
        fence = '';
      }
      continue;
    }
    if (inFence) {
      continue;
    }
    onLine(rawLine, i + 1);
  }
}

/**
 * Extract every `](target)` link target (with its line number), skipping fenced
 * and inline code. Link titles (`[t](url "title")`) and angle-bracket wrapping
 * (`[t](<url>)`) are stripped to the bare target.
 */
export function extractLinkTargets(markdown: string): LineRef[] {
  const out: LineRef[] = [];
  forEachProseLine(markdown, (rawLine, lineNo) => {
    const line = stripInlineCode(rawLine);
    let open = line.indexOf('](');
    while (open !== -1) {
      const start = open + 2;
      const close = line.indexOf(')', start);
      if (close === -1) {
        break;
      }
      let target = line.slice(start, close).trim();
      const space = target.indexOf(' ');
      if (space !== -1) {
        target = target.slice(0, space);
      }
      if (target.startsWith('<') && target.endsWith('>')) {
        target = target.slice(1, -1);
      }
      if (target.length > 0) {
        out.push({ line: lineNo, text: target });
      }
      open = line.indexOf('](', close + 1);
    }
  });
  return out;
}

/**
 * Extract every single-backtick inline-code span's contents (with line number),
 * skipping fenced code. Odd-index segments of a backtick split are inside code.
 */
export function extractInlineCodeSpans(markdown: string): LineRef[] {
  const out: LineRef[] = [];
  forEachProseLine(markdown, (rawLine, lineNo) => {
    if (!rawLine.includes('`')) {
      return;
    }
    const parts = rawLine.split('`');
    for (let i = 1; i < parts.length; i += 2) {
      const text = parts[i];
      if (text.length > 0) {
        out.push({ line: lineNo, text });
      }
    }
  });
  return out;
}
