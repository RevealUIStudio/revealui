/**
 * File Parsers
 *
 * Zero external dependencies  -  pure Node.js + regex/string manipulation.
 * PDF extraction uses a hand-rolled parser that reads text streams directly
 * from the binary PDF format (BT/ET blocks, Tj/TJ operators).
 */

export interface ParseResult {
  text: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Plain Text
// =============================================================================

export class PlainTextParser {
  parse(input: string): ParseResult {
    return { text: input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() };
  }
}

// =============================================================================
// Markdown
// =============================================================================

const FRONTMATTER_RE = /^---[\s\S]*?---\n?/;
const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`]*`/g;
const HEADING_RE = /^#{1,6}\s+/gm;
const EMPHASIS_RE = /[*_]{1,3}([^*_]+)[*_]{1,3}/g;
const LINK_RE = /\[([^\]]*)\]\([^)]*\)/g;
const IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/g;
const HTML_TAG_IN_MD_RE = /<[^>]+>/g;
const HORIZONTAL_RULE_RE = /^[-*_]{3,}\s*$/gm;

export class MarkdownParser {
  parse(input: string): ParseResult {
    const text = input
      // Strip frontmatter
      .replace(FRONTMATTER_RE, '')
      // Strip code fences (preserve content inside)
      .replace(CODE_FENCE_RE, (m) => m.replace(/```\w*\n?/g, '').replace(/```/g, ''))
      // Strip inline code backticks but keep content
      .replace(INLINE_CODE_RE, (m) => m.slice(1, -1))
      // Strip heading markers
      .replace(HEADING_RE, '')
      // Unwrap bold/italic  -  keep inner text
      .replace(EMPHASIS_RE, '$1')
      // Unwrap links  -  keep link text
      .replace(LINK_RE, '$1')
      // Remove images entirely
      .replace(IMAGE_RE, '')
      // Strip inline HTML
      .replace(HTML_TAG_IN_MD_RE, '')
      // Remove horizontal rules
      .replace(HORIZONTAL_RULE_RE, '')
      // Normalize CRLF
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Collapse 3+ blank lines to 2
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text };
  }
}

// =============================================================================
// HTML
// =============================================================================

const SCRIPT_STYLE_RE = /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HTML_ALL_TAGS_RE = /<[^>]+>/g;
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&apos;': "'",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&[a-z]+;|&#\d+;/gi, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)));
}

export class HtmlParser {
  parse(input: string): ParseResult {
    const text = decodeEntities(
      input
        .replace(SCRIPT_STYLE_RE, '')
        .replace(HTML_COMMENT_RE, '')
        .replace(HTML_ALL_TAGS_RE, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    );
    return { text };
  }
}

// =============================================================================
// PDF
// =============================================================================

/**
 * Decode a PDF literal string token.
 *
 * PDF literal strings are enclosed in `(…)` and support:
 * - Escape sequences: \n \r \t \b \f \\ \( \)
 * - Octal escapes: \nnn
 * - Line continuation: \ at end of line (ignored)
 */
function decodePdfLiteral(raw: string): string {
  return raw.replace(/\\([\\()nrtbf]|[0-7]{1,3}|\n)/g, (_, esc: string) => {
    if (esc === '\n') return '';
    if (esc === 'n') return '\n';
    if (esc === 'r') return '\r';
    if (esc === 't') return '\t';
    if (esc === 'b') return '\b';
    if (esc === 'f') return '\f';
    if (esc === '\\') return '\\';
    if (esc === '(') return '(';
    if (esc === ')') return ')';
    // Octal
    return String.fromCharCode(Number.parseInt(esc, 8));
  });
}

/**
 * Extract text from a single BT…ET block.
 * Handles: (string)Tj  [(array)]TJ  (string)'  (string)"
 */
function extractTextFromBlock(block: string): string {
  const parts: string[] = [];

  // Tj  -  show string: (text) Tj
  const tjRe = /\(([^)]*(?:\\.[^)]*)*)\)\s*Tj/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((m = tjRe.exec(block)) !== null) {
    if (m[1] !== undefined) parts.push(decodePdfLiteral(m[1]));
  }

  // TJ  -  show array: [(t1)(t2) num …] TJ
  const tjArrayRe = /\[([^\]]*)\]\s*TJ/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((m = tjArrayRe.exec(block)) !== null) {
    const inner = m[1] ?? '';
    const strRe = /\(([^)]*(?:\\.[^)]*)*)\)/g;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
    while ((m = strRe.exec(inner)) !== null) {
      if (m[1] !== undefined) parts.push(decodePdfLiteral(m[1]));
    }
  }

  // ' and " operators (move-to-next-line-then-show)
  const quoteRe = /\(([^)]*(?:\\.[^)]*)*)\)\s*['"]/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((m = quoteRe.exec(block)) !== null) {
    if (m[1] !== undefined) parts.push(decodePdfLiteral(m[1]));
  }

  return parts.join(' ');
}

/**
 * Hand-rolled PDF text extractor.
 *
 * Reads text content directly from the binary PDF format without any
 * external dependencies. Works for text-based PDFs (the vast majority).
 * Encrypted or image-only PDFs return an empty string.
 *
 * Supports:
 * - BT/ET text blocks with Tj, TJ, ' and " operators
 * - Literal string decoding (escape sequences + octal)
 * - Page count from /Count dictionary entry
 * - Document title from /Title dictionary entry
 *
 */
export class PdfParser {
  /** Parse a PDF string (for API compatibility; use parseBuffer for binary data). */
  parse(input: string): ParseResult {
    return this.parseBuffer(Buffer.from(input, 'binary'));
  }

  /** Parse a PDF from a Buffer. */
  parseBuffer(input: Buffer): ParseResult & { metadata: { pageCount: number; title?: string } } {
    const src = input.toString('binary');

    // Extract all BT…ET text blocks
    const btEtRe = /BT\s([\s\S]*?)\sET/g;
    const blocks: string[] = [];
    let m: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
    while ((m = btEtRe.exec(src)) !== null) {
      if (m[1] !== undefined) blocks.push(m[1]);
    }

    const rawText = blocks.map(extractTextFromBlock).filter(Boolean).join('\n');
    const text = rawText
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Page count from /Count N
    const countMatch = /\/Count\s+(\d+)/.exec(src);
    const pageCount = countMatch ? Number.parseInt(countMatch[1] ?? '0', 10) : 0;

    // Document title from /Title (string) or /Title <hex>
    let title: string | undefined;
    const titleMatch = /\/Title\s*\(([^)]*(?:\\.[^)]*)*)\)/.exec(src);
    if (titleMatch) {
      title = decodePdfLiteral(titleMatch[1] ?? '').trim() || undefined;
    }

    return {
      text,
      metadata: {
        pageCount,
        ...(title ? { title } : {}),
      },
    };
  }
}

// =============================================================================
// JSON
// =============================================================================

export class JsonParser {
  parse(input: string): ParseResult {
    try {
      const parsed: unknown = JSON.parse(input);
      return { text: JSON.stringify(parsed, null, 2) };
    } catch {
      // Not valid JSON  -  return as-is
      return { text: input.trim() };
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export type Parser = PlainTextParser | MarkdownParser | HtmlParser | JsonParser | PdfParser;

export function createParser(mimeType: string): Parser {
  const normalized = mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (normalized === 'text/markdown' || normalized === 'text/x-markdown') {
    return new MarkdownParser();
  }
  if (normalized === 'text/html' || normalized === 'application/xhtml+xml') {
    return new HtmlParser();
  }
  if (normalized === 'application/json') {
    return new JsonParser();
  }
  if (normalized === 'application/pdf') {
    return new PdfParser();
  }
  // Default: plain text (covers text/plain and unknown types)
  return new PlainTextParser();
}
