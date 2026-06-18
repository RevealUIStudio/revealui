/**
 * Markdown rendering utilities for documentation
 */

import { logger } from '@revealui/core/observability/logger';
import type React from 'react';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseFrontmatter } from './frontmatter';

const JS_KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'switch',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'yield',
]);

const SHELL_KEYWORDS = new Set([
  'export',
  'pnpm',
  'npm',
  'npx',
  'node',
  'bash',
  'sh',
  'git',
  'docker',
  'cd',
  'cp',
  'mv',
  'rm',
  'echo',
  'revealui',
]);

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'property'
  | 'tag'
  | 'attr';

export interface Token {
  kind: TokenKind;
  value: string;
}

function pushToken(tokens: Token[], kind: TokenKind, value: string) {
  if (value.length > 0) {
    tokens.push({ kind, value });
  }
}

// ---------------------------------------------------------------------------
// Character scanners (no authored regex — fleet no-regex hardline, M2).
// Each tokenizer walks the line one char at a time, accumulating a "plain" run
// and flushing it whenever a typed token (string/number/identifier/…) starts.
// ---------------------------------------------------------------------------

// Accept `string | undefined` so callers can pass `line[i]` directly under
// tsconfig `noUncheckedIndexedAccess` — out-of-range indices are simply not
// matched (every predicate is false for undefined).
const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isLower = (c: string | undefined): boolean => c !== undefined && c >= 'a' && c <= 'z';
const isUpper = (c: string | undefined): boolean => c !== undefined && c >= 'A' && c <= 'Z';
const isAlpha = (c: string | undefined): boolean => isLower(c) || isUpper(c);
const isSpace = (c: string | undefined): boolean => c === ' ' || c === '\t';
const isIdentStart = (c: string | undefined): boolean => isAlpha(c) || c === '_' || c === '$';
const isIdentChar = (c: string | undefined): boolean => isIdentStart(c) || isDigit(c);

/** Scan a quoted string starting at `start` (line[start] is the quote). Honors
 *  backslash escapes; on an unterminated string consumes to end-of-line. Returns
 *  the index just past the closing quote. */
function scanString(line: string, start: number): number {
  const quote = line[start];
  let i = start + 1;
  while (i < line.length) {
    const c = line[i];
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

/** Scan a number (optional leading `-`, digits, optional `.frac`, optional
 *  `e[+-]exp`). Returns the index just past the number. */
function scanNumber(line: string, start: number): number {
  let i = start;
  if (line[i] === '-') {
    i += 1;
  }
  while (i < line.length && isDigit(line[i])) {
    i += 1;
  }
  if (line[i] === '.') {
    i += 1;
    while (i < line.length && isDigit(line[i])) {
      i += 1;
    }
  }
  if (line[i] === 'e' || line[i] === 'E') {
    let j = i + 1;
    if (line[j] === '+' || line[j] === '-') {
      j += 1;
    }
    if (j < line.length && isDigit(line[j])) {
      i = j + 1;
      while (i < line.length && isDigit(line[i])) {
        i += 1;
      }
    }
  }
  return i;
}

/** Scan an identifier starting at `start` (line[start] is an ident-start char). */
function scanIdent(line: string, start: number): number {
  let i = start + 1;
  while (i < line.length && isIdentChar(line[i])) {
    i += 1;
  }
  return i;
}

function highlightJsonLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let plainStart = 0;
  const flush = (end: number) => pushToken(tokens, 'plain', line.slice(plainStart, end));

  while (i < line.length) {
    const c = line[i];
    if (c === '"') {
      const end = scanString(line, i);
      // A string is a property key when the next non-space char is a colon.
      let k = end;
      while (k < line.length && isSpace(line[k])) {
        k += 1;
      }
      flush(i);
      pushToken(tokens, line[k] === ':' ? 'property' : 'string', line.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    if (isDigit(c) || (c === '-' && isDigit(line[i + 1] ?? ''))) {
      const end = scanNumber(line, i);
      flush(i);
      pushToken(tokens, 'number', line.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    if (isIdentStart(c)) {
      const end = scanIdent(line, i);
      const word = line.slice(i, end);
      if (word === 'true' || word === 'false' || word === 'null') {
        flush(i);
        pushToken(tokens, 'keyword', word);
        plainStart = end;
      }
      i = end;
      continue;
    }
    i += 1;
  }
  flush(line.length);
  return tokens;
}

function highlightShellLine(line: string): Token[] {
  const hash = line.indexOf('#');
  const active = hash >= 0 ? line.slice(0, hash) : line;
  const comment = hash >= 0 ? line.slice(hash) : '';
  const tokens: Token[] = [];
  let i = 0;
  let plainStart = 0;
  const flush = (end: number) => pushToken(tokens, 'plain', active.slice(plainStart, end));

  while (i < active.length) {
    const c = active[i];
    if (c === '"' || c === "'") {
      const end = scanString(active, i);
      flush(i);
      pushToken(tokens, 'string', active.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    // Shell variable: $UPPER_NAME
    if (c === '$' && (isUpper(active[i + 1] ?? '') || active[i + 1] === '_')) {
      let j = i + 1;
      while (j < active.length && (isUpper(active[j]) || isDigit(active[j]) || active[j] === '_')) {
        j += 1;
      }
      flush(i);
      pushToken(tokens, 'property', active.slice(i, j));
      i = j;
      plainStart = i;
      continue;
    }
    // Flag: -x / --name
    if (c === '-') {
      let j = i + 1;
      if (active[j] === '-') {
        j += 1;
      }
      if (j < active.length && (isAlpha(active[j]) || isDigit(active[j]))) {
        j += 1;
        while (j < active.length && (isIdentChar(active[j]) || active[j] === '-')) {
          j += 1;
        }
        flush(i);
        pushToken(tokens, 'property', active.slice(i, j));
        i = j;
        plainStart = i;
        continue;
      }
    }
    if (isDigit(c)) {
      const end = scanNumber(active, i);
      flush(i);
      pushToken(tokens, 'number', active.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    if (isIdentStart(c)) {
      const end = scanIdent(active, i);
      const word = active.slice(i, end);
      if (SHELL_KEYWORDS.has(word)) {
        flush(i);
        pushToken(tokens, 'keyword', word);
        plainStart = end;
      }
      i = end;
      continue;
    }
    i += 1;
  }
  flush(active.length);
  pushToken(tokens, 'comment', comment);
  return tokens;
}

function highlightMarkupLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let plainStart = 0;
  const flush = (end: number) => pushToken(tokens, 'plain', line.slice(plainStart, end));

  while (i < line.length) {
    const c = line[i];
    // Opening/closing tag name: <tag or </tag
    if (c === '<') {
      let j = i + 1;
      if (line[j] === '/') {
        j += 1;
      }
      if (j < line.length && isAlpha(line[j])) {
        j += 1;
        while (j < line.length && line[j] !== '>' && line[j] !== '/' && !isSpace(line[j])) {
          j += 1;
        }
        flush(i);
        pushToken(tokens, 'tag', line.slice(i, j));
        i = j;
        plainStart = i;
        continue;
      }
    }
    if (c === '/' && line[i + 1] === '>') {
      flush(i);
      pushToken(tokens, 'tag', '/>');
      i += 2;
      plainStart = i;
      continue;
    }
    if (c === '>') {
      flush(i);
      pushToken(tokens, 'tag', '>');
      i += 1;
      plainStart = i;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = scanString(line, i);
      flush(i);
      pushToken(tokens, 'string', line.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    // Attribute name: whitespace, then a name, then `=`
    if (isSpace(c)) {
      let j = i;
      while (j < line.length && isSpace(line[j])) {
        j += 1;
      }
      if (j < line.length && (isAlpha(line[j]) || line[j] === '_' || line[j] === ':')) {
        let k = j + 1;
        while (
          k < line.length &&
          (isIdentChar(line[k]) || line[k] === ':' || line[k] === '.' || line[k] === '-')
        ) {
          k += 1;
        }
        if (line[k] === '=') {
          flush(i);
          pushToken(tokens, 'attr', line.slice(i, k));
          i = k;
          plainStart = i;
          continue;
        }
      }
    }
    i += 1;
  }
  flush(line.length);
  return tokens;
}

function highlightScriptLine(line: string): Token[] {
  const slashes = line.indexOf('//');
  const active = slashes >= 0 ? line.slice(0, slashes) : line;
  const comment = slashes >= 0 ? line.slice(slashes) : '';
  const tokens: Token[] = [];
  let i = 0;
  let plainStart = 0;
  const flush = (end: number) => pushToken(tokens, 'plain', active.slice(plainStart, end));

  while (i < active.length) {
    const c = active[i];
    if (c === '"' || c === "'" || c === '`') {
      const end = scanString(active, i);
      flush(i);
      pushToken(tokens, 'string', active.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    if (isDigit(c)) {
      const end = scanNumber(active, i);
      flush(i);
      pushToken(tokens, 'number', active.slice(i, end));
      i = end;
      plainStart = i;
      continue;
    }
    if (isIdentStart(c)) {
      const end = scanIdent(active, i);
      const word = active.slice(i, end);
      if (JS_KEYWORDS.has(word)) {
        flush(i);
        pushToken(tokens, 'keyword', word);
        plainStart = end;
      }
      i = end;
      continue;
    }
    i += 1;
  }
  flush(active.length);
  pushToken(tokens, 'comment', comment);
  return tokens;
}

/**
 * Tokenize a fenced code block by language.
 *
 * Routing note: `tsx`/`jsx` are JavaScript-family languages — they go to the
 * script tokenizer, NOT the markup one (the prior version checked markup first
 * and silently mis-highlighted every TSX/JSX block as HTML). `sql`/`yaml` have
 * no dedicated tokenizer; they render as plain text rather than being forced
 * through the JS tokenizer (which mis-colored their keywords).
 */
export function highlightCode(code: string, language?: string): Token[][] {
  const lang = language?.toLowerCase();

  return code.split('\n').map((line) => {
    if (lang === 'json') {
      return highlightJsonLine(line);
    }
    if (lang === 'bash' || lang === 'sh' || lang === 'shell' || lang === 'zsh') {
      return highlightShellLine(line);
    }
    if (lang === 'html' || lang === 'xml') {
      return highlightMarkupLine(line);
    }
    if (
      lang === 'js' ||
      lang === 'jsx' ||
      lang === 'ts' ||
      lang === 'tsx' ||
      lang === 'javascript' ||
      lang === 'typescript'
    ) {
      return highlightScriptLine(line);
    }
    return [{ kind: 'plain', value: line }];
  });
}

/** Extract the `language-<x>` class react-markdown sets on a code element.
 *  No regex (M2): split the class list and match the prefix. */
export function extractLanguage(className: string | undefined): string | undefined {
  if (!className) {
    return undefined;
  }
  const prefix = 'language-';
  for (const cls of className.split(' ')) {
    if (cls.startsWith(prefix) && cls.length > prefix.length) {
      return cls.slice(prefix.length);
    }
  }
  return undefined;
}

function CodeRenderer({
  className,
  children,
}: React.ComponentProps<'code'> & { node?: unknown }): React.ReactElement {
  const raw = String(children ?? '');
  const language = extractLanguage(className ?? undefined);

  if (!language) {
    return <code className={className}>{children}</code>;
  }

  const content = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  const lines = highlightCode(content, language);

  return (
    <code className={`code-block language-${language}`}>
      {lines.map((line, lineIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: code lines have stable order from syntax highlighting
        <span key={`line-${lineIndex}`} className="code-line">
          {line.length === 0
            ? ' '
            : line.map((token, tokenIndex) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: tokens within a line have stable order
                  key={`token-${lineIndex}-${tokenIndex}`}
                  className={token.kind === 'plain' ? undefined : `token-${token.kind}`}
                >
                  {token.value}
                </span>
              ))}
          {lineIndex < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </code>
  );
}

function CopyablePreBlock({ children, ...props }: React.ComponentProps<'pre'>): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? '';
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="group/code relative">
      <pre ref={preRef} {...props}>
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover/code:opacity-100"
        aria-label="Copy code"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export function renderMarkdown(content: string): React.ReactElement {
  // Strip any leading frontmatter block so it never renders. Self-protecting:
  // bodies without frontmatter and arbitrary inline strings pass through
  // unchanged — parseFrontmatter only matches a well-formed leading block.
  const { body } = parseFrontmatter(content);
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ code: CodeRenderer, pre: CopyablePreBlock }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}

export type {
  FrontmatterData,
  FrontmatterScalar,
  FrontmatterValue,
  ParsedFrontmatter,
} from './frontmatter';
// Re-exported so route pages can lift metadata (title/date/author) into page
// chrome without rendering it: `import { parseFrontmatter } from '@/utils/markdown'`.
export { parseFrontmatter } from './frontmatter';

/**
 * In-memory cache for loaded markdown files
 * Key: file path, Value: { content: string, timestamp: number }
 */
const markdownCache = new Map<string, { content: string; timestamp: number }>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Load markdown file from public directory with caching
 * Files are copied there by the Vite plugin during dev/build
 */
export async function loadMarkdownFile(
  filePath: string,
  useCache = true,
  signal?: AbortSignal,
): Promise<string> {
  // Ensure path starts with /
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

  // Check cache first
  if (useCache) {
    const cached = markdownCache.get(normalizedPath);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_TTL) {
        return cached.content;
      }
      // Cache expired, remove it
      markdownCache.delete(normalizedPath);
    }
  }

  try {
    const response =
      signal !== undefined ? await fetch(normalizedPath, { signal }) : await fetch(normalizedPath);
    if (!response.ok) {
      throw new Error(`Failed to load markdown file: ${normalizedPath} (${response.status})`);
    }

    const content = await response.text();

    // Store in cache
    if (useCache) {
      markdownCache.set(normalizedPath, {
        content,
        timestamp: Date.now(),
      });
    }

    return content;
  } catch (error) {
    // Provide helpful error message with logging
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `[markdown-loader] Failed to load: ${normalizedPath}`,
      error instanceof Error ? error : new Error(errorMessage),
    );

    throw new Error(
      `Failed to load markdown file: ${normalizedPath}. ` +
        `Make sure the file exists in docs/ directory and has been copied by the Vite plugin. ` +
        `Error: ${errorMessage}`,
    );
  }
}

/**
 * Clear the markdown cache (useful for testing or manual refresh)
 */
export function clearMarkdownCache(): void {
  markdownCache.clear();
}

/**
 * Clear a specific file from cache
 */
export function clearMarkdownCacheEntry(filePath: string): void {
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
  markdownCache.delete(normalizedPath);
}

/**
 * Get cache statistics (for debugging)
 */
export function getMarkdownCacheStats(): {
  size: number;
  entries: Array<{ path: string; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(markdownCache.entries()).map(([path, value]) => ({
    path,
    age: now - value.timestamp,
  }));

  return {
    size: markdownCache.size,
    entries,
  };
}
