/**
 * Client-side full-text search index for documentation.
 *
 * Fetches all markdown docs listed in INDEX.md, extracts titles and
 * excerpts, and indexes them with FlexSearch for instant search.
 */

import FlexSearch from 'flexsearch';

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
// Helpers
// ---------------------------------------------------------------------------

/** Extract the first H1 heading from markdown content. */
function extractTitle(markdown: string): string {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim() ?? '';
}

/** Extract the first non-heading, non-empty paragraph as an excerpt. */
function extractExcerpt(markdown: string, maxLength = 160): string {
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headings, links-only lines, and horizontal rules
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('---') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('- [') ||
      trimmed.startsWith('* [') ||
      trimmed.startsWith('```')
    ) {
      continue;
    }
    // Strip inline markdown formatting
    const plain = trimmed
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/[*_`~]+/g, '') // bold, italic, code, strikethrough
      .trim();
    if (plain.length > 10) {
      return plain.length > maxLength ? `${plain.slice(0, maxLength)}...` : plain;
    }
  }
  return '';
}

/** Parse INDEX.md to extract markdown filenames. */
function parseIndex(indexContent: string): string[] {
  const files: string[] = [];
  // Match lines like: - [Title](./FILENAME.md)
  const linkRegex = /\[.*?\]\(\.\/([A-Z_]+\.md)\)/g;
  let match: RegExpExecArray | null = null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
  while ((match = linkRegex.exec(indexContent)) !== null) {
    const filename = match[1];
    if (filename) {
      files.push(filename);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the search index by fetching INDEX.md and all referenced docs.
 * Safe to call multiple times  -  subsequent calls return the same promise.
 */
export async function buildSearchIndex(): Promise<void> {
  if (buildPromise) {
    return buildPromise;
  }

  buildPromise = (async () => {
    try {
      // Fetch and parse the index
      const indexResponse = await fetch('/docs/INDEX.md');
      if (!indexResponse.ok) {
        return;
      }
      const indexContent = await indexResponse.text();
      const filenames = parseIndex(indexContent);

      // Fetch all docs in parallel
      const fetchResults = await Promise.allSettled(
        filenames.map(async (filename) => {
          const response = await fetch(`/docs/${filename}`);
          if (!response.ok) {
            return null;
          }
          const content = await response.text();
          const slug = filename.replace(/\.md$/, '');
          return {
            filename: slug,
            content,
          };
        }),
      );

      // Build entries
      docs = [];
      let id = 0;
      for (const result of fetchResults) {
        if (result.status !== 'fulfilled' || !result.value) {
          continue;
        }
        const { filename, content } = result.value;
        const title = extractTitle(content) || filename.replace(/_/g, ' ');
        const excerpt = extractExcerpt(content);

        docs.push({
          id,
          title,
          content,
          path: filename,
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
