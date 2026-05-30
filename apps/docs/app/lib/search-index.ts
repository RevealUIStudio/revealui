/**
 * Client-side full-text search index for documentation.
 *
 * Indexes EVERY served doc enumerated in the slug manifest — the same
 * build-time enumeration the route resolver uses — not just the handful of
 * uppercase top-level files linked from INDEX.md. That is what makes nested
 * sections (guides/, blog/, fleet/, api/), pro docs, and hyphenated or
 * lowercase filenames searchable; the previous INDEX.md `[A-Z_]+.md` scrape
 * silently dropped all of them. Internal-only docs are absent from the served
 * set, so their fetch 404s and they are skipped automatically (never indexed,
 * never leaked into results).
 *
 * No authored regex (fleet hardline, matching scripts/check-links.ts): title
 * and excerpt extraction are indexOf / character scans.
 */

import FlexSearch from 'flexsearch';
import { SLUG_TO_PATH } from './slug-manifest';

const { Document } = FlexSearch;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string;
  path: string;
  excerpt: string;
}

interface DocEntry {
  [key: string]: string | number;
  id: number;
  title: string;
  content: string;
  path: string;
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Module state (singleton  -  built once per page load)
// ---------------------------------------------------------------------------

let index: InstanceType<typeof Document> | null = null;
let docs: DocEntry[] = [];
let buildPromise: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// Helpers (no authored regex)
// ---------------------------------------------------------------------------

/** Inline emphasis markers stripped from excerpts (bold, italic, code, strikethrough). */
const EXCERPT_EMPHASIS = new Set(['*', '_', '`', '~']);

/** Extract the first ATX H1 (`# Title`) from markdown content. */
export function extractTitle(markdown: string): string {
  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) {
      continue;
    }
    const rest = line.slice(1);
    // A single `#` followed by whitespace is an H1. `##`/`###` (rest starts
    // with another `#`) and a bare `#` fall through.
    if (rest.length > 0 && (rest[0] === ' ' || rest[0] === '\t')) {
      return rest.trim();
    }
  }
  return '';
}

/** Replace `[label](target)` spans with just their label (indexOf scan). */
function stripMarkdownLinks(text: string): string {
  if (!text.includes('](')) {
    return text;
  }
  let out = '';
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('[', cursor);
    if (open === -1) {
      out += text.slice(cursor);
      break;
    }
    const mid = text.indexOf('](', open);
    if (mid === -1) {
      out += text.slice(cursor);
      break;
    }
    const close = text.indexOf(')', mid + 2);
    if (close === -1) {
      out += text.slice(cursor);
      break;
    }
    out += text.slice(cursor, open); // text before the link
    out += text.slice(open + 1, mid); // the link label
    cursor = close + 1; // skip past the (target)
  }
  return out;
}

/** Remove inline emphasis markers (`*`, `_`, `` ` ``, `~`). */
function stripEmphasis(text: string): string {
  let out = '';
  for (const ch of text) {
    if (!EXCERPT_EMPHASIS.has(ch)) {
      out += ch;
    }
  }
  return out;
}

/** Extract the first substantive paragraph as a plain-text excerpt. */
export function extractExcerpt(markdown: string, maxLength = 160): string {
  let inFence = false;
  for (const rawLine of markdown.split('\n')) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    // Skip empty lines, headings, horizontal rules, tables, link-only list items.
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('---') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('- [') ||
      trimmed.startsWith('* [')
    ) {
      continue;
    }
    const plain = stripEmphasis(stripMarkdownLinks(trimmed)).trim();
    if (plain.length > 10) {
      return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
    }
  }
  return '';
}

/**
 * The full set of searchable docs as `[slug, file]` pairs, sourced from the
 * slug manifest. The slug doubles as the result path (flat URL space); the
 * file is fetched from the served root.
 */
export function listSearchDocPaths(): Array<readonly [string, string]> {
  return Object.entries(SLUG_TO_PATH);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the search index by fetching every served doc and indexing it.
 * Safe to call multiple times  -  subsequent calls return the same promise.
 */
export async function buildSearchIndex(): Promise<void> {
  if (buildPromise) {
    return buildPromise;
  }

  buildPromise = (async () => {
    try {
      // Fetch all enumerated docs in parallel. Internal-only docs are not in
      // the served set, so their fetch 404s and they fall out via the !ok
      // guard — they are never indexed.
      const fetchResults = await Promise.allSettled(
        listSearchDocPaths().map(async ([slug, file]) => {
          const response = await fetch(`/${file}`);
          if (!response.ok) {
            return null;
          }
          const content = await response.text();
          return { slug, content };
        }),
      );

      // Build entries
      docs = [];
      let id = 0;
      for (const result of fetchResults) {
        if (result.status !== 'fulfilled' || !result.value) {
          continue;
        }
        const { slug, content } = result.value;
        const title = extractTitle(content) || slug;
        const excerpt = extractExcerpt(content);

        docs.push({
          id,
          title,
          content,
          path: slug,
          excerpt,
        });
        id++;
      }

      // Build FlexSearch document index
      index = new Document({
        document: {
          id: 'id',
          index: ['title', 'content'],
          store: true,
        },
        tokenize: 'forward',
        cache: true,
      });

      for (const doc of docs) {
        index.add(doc);
      }
    } catch {
      // Silently fail  -  search will return empty results
      index = null;
      docs = [];
    }
  })();

  return buildPromise;
}

/**
 * Search the docs index. Returns up to 10 results.
 * Returns an empty array if the index has not been built yet.
 */
export function searchDocs(query: string): SearchResult[] {
  if (!(index && query.trim())) {
    return [];
  }

  // Use non-enriched search (returns field + id arrays), then look up docs
  const rawResults = index.search(query, { limit: 10 }) as Array<{
    field: string;
    result: Array<string | number>;
  }>;

  // Deduplicate across fields (title + content both return results)
  const seen = new Set<number>();
  const results: SearchResult[] = [];

  for (const fieldResult of rawResults) {
    for (const id of fieldResult.result) {
      const numId = typeof id === 'string' ? Number.parseInt(id, 10) : id;
      if (seen.has(numId)) {
        continue;
      }
      seen.add(numId);
      const doc = docs[numId];
      if (doc) {
        results.push({
          title: doc.title,
          path: doc.path,
          excerpt: doc.excerpt,
        });
      }
    }
  }

  return results.slice(0, 10);
}
