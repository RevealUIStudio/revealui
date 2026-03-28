/**
 * Markdown rendering utilities for documentation
 */

import { logger } from '@revealui/core/observability/logger';
import type React from 'react';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

type TokenKind =
  | 'plain'
  | 'comment'
  | 'keyword'
  | 'string'
  | 'number'
  | 'property'
  | 'tag'
  | 'attr';

interface Token {
  kind: TokenKind;
  value: string;
}

function pushToken(tokens: Token[], kind: TokenKind, value: string) {
  if (value.length > 0) {
    tokens.push({ kind, value });
  }
}

function highlightJsonLine(line: string): Token[] {
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const propertyMatch = remaining.match(/^(\s*)"([^"]+)"(?=\s*:)/);
    if (propertyMatch) {
      pushToken(tokens, 'plain', propertyMatch[1] ?? '');
      pushToken(tokens, 'property', `"${propertyMatch[2]}"`);
      remaining = remaining.slice(propertyMatch[0].length);
      continue;
    }

    const stringMatch = remaining.match(/^"(?:\\.|[^"])*"/);
    if (stringMatch) {
      pushToken(tokens, 'string', stringMatch[0]);
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    const numberMatch = remaining.match(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
    if (numberMatch) {
      pushToken(tokens, 'number', numberMatch[0]);
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    const keywordMatch = remaining.match(/^(true|false|null)\b/);
    if (keywordMatch) {
      pushToken(tokens, 'keyword', keywordMatch[0]);
      remaining = remaining.slice(keywordMatch[0].length);
      continue;
    }

    pushToken(tokens, 'plain', remaining[0] ?? '');
    remaining = remaining.slice(1);
  }

  return tokens;
}

function highlightShellLine(line: string): Token[] {
  const commentIndex = line.indexOf('#');
  const activePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : '';
  const tokens: Token[] = [];
  const pattern =
    /(\$[A-Z_][A-Z0-9_]*|\b(?:export|pnpm|npm|npx|node|bash|sh|git|docker|cd|cp|mv|rm|echo|revealui)\b|--?[a-zA-Z0-9][\w-]*|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b\d+(?:\.\d+)?\b)/g;

  let lastIndex = 0;
  for (const match of activePart.matchAll(pattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    pushToken(tokens, 'plain', activePart.slice(lastIndex, index));

    if (value.startsWith('"') || value.startsWith("'")) {
      pushToken(tokens, 'string', value);
    } else if (value.startsWith('$') || value.startsWith('--') || value.startsWith('-')) {
      pushToken(tokens, 'property', value);
    } else if (/^\d/.test(value)) {
      pushToken(tokens, 'number', value);
    } else {
      pushToken(tokens, 'keyword', value);
    }

    lastIndex = index + value.length;
  }

  pushToken(tokens, 'plain', activePart.slice(lastIndex));
  pushToken(tokens, 'comment', commentPart);
  return tokens;
}

function highlightMarkupLine(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /(<\/?[A-Za-z][^>\s/>]*|\/?>|\s+[A-Za-z_:][A-Za-z0-9:._-]*(?==)|"(?:\\.|[^"])*")/g;
  let lastIndex = 0;

  for (const match of line.matchAll(pattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    pushToken(tokens, 'plain', line.slice(lastIndex, index));

    if (value.startsWith('<') || value === '/>' || value === '>') {
      pushToken(tokens, 'tag', value);
    } else if (value.startsWith('"')) {
      pushToken(tokens, 'string', value);
    } else {
      pushToken(tokens, 'attr', value);
    }

    lastIndex = index + value.length;
  }

  pushToken(tokens, 'plain', line.slice(lastIndex));
  return tokens;
}

function highlightScriptLine(line: string): Token[] {
  const commentIndex = line.indexOf('//');
  const activePart = commentIndex >= 0 ? line.slice(0, commentIndex) : line;
  const commentPart = commentIndex >= 0 ? line.slice(commentIndex) : '';
  const tokens: Token[] = [];
  const pattern =
    /"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;
  let lastIndex = 0;

  for (const match of activePart.matchAll(pattern)) {
    const value = match[0];
    const index = match.index ?? 0;
    pushToken(tokens, 'plain', activePart.slice(lastIndex, index));

    if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
      pushToken(tokens, 'string', value);
    } else if (/^\d/.test(value)) {
      pushToken(tokens, 'number', value);
    } else if (JS_KEYWORDS.has(value)) {
      pushToken(tokens, 'keyword', value);
    } else {
      pushToken(tokens, 'plain', value);
    }

    lastIndex = index + value.length;
  }

  pushToken(tokens, 'plain', activePart.slice(lastIndex));
  pushToken(tokens, 'comment', commentPart);
  return tokens;
}

function highlightCode(code: string, language?: string): Token[][] {
  const normalizedLanguage = language?.toLowerCase();

  return code.split('\n').map((line) => {
    if (normalizedLanguage === 'json') {
      return highlightJsonLine(line);
    }

    if (
      normalizedLanguage === 'bash' ||
      normalizedLanguage === 'sh' ||
      normalizedLanguage === 'shell' ||
      normalizedLanguage === 'zsh'
    ) {
      return highlightShellLine(line);
    }

    if (
      normalizedLanguage === 'html' ||
      normalizedLanguage === 'xml' ||
      normalizedLanguage === 'tsx' ||
      normalizedLanguage === 'jsx'
    ) {
      return highlightMarkupLine(line);
    }

    if (
      normalizedLanguage === 'js' ||
      normalizedLanguage === 'ts' ||
      normalizedLanguage === 'tsx' ||
      normalizedLanguage === 'jsx' ||
      normalizedLanguage === 'sql' ||
      normalizedLanguage === 'yaml' ||
      normalizedLanguage === 'yml'
    ) {
      return highlightScriptLine(line);
    }

    return [{ kind: 'plain', value: line }];
  });
}

function CodeRenderer({
  className,
  children,
}: React.ComponentProps<'code'> & { node?: unknown }): React.ReactElement {
  const raw = String(children ?? '');
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1];

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
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ code: CodeRenderer, pre: CopyablePreBlock }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

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
export async function loadMarkdownFile(filePath: string, useCache = true): Promise<string> {
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
    const response = await fetch(normalizedPath);
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
