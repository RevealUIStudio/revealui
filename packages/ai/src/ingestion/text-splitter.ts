/**
 * Recursive Character Text Splitter
 *
 * Splits text into chunks using a hierarchy of separators:
 *   double-newline → single-newline → period+space → space
 * Token count is estimated as Math.ceil(length / 4) — sufficient for chunking.
 */

export interface Chunk {
  content: string;
  tokenCount: number;
  index: number;
  metadata?: Record<string, unknown>;
}

export interface SplitOptions {
  chunkSize?: number; // characters (default 512)
  overlap?: number; // characters (default 64)
  metadata?: Record<string, unknown>;
}

const SEPARATORS = ['\n\n', '\n', '. ', ' '] as const;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitOnSeparator(text: string, separator: string): string[] {
  if (!text.includes(separator)) return [text];
  // Split and re-attach separator to previous segment (keep context)
  const parts = text.split(separator);
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (i < parts.length - 1) {
      result.push(part + separator);
    } else if (part.length > 0) {
      result.push(part);
    }
  }
  return result;
}

function mergeSegments(segments: string[], chunkSize: number): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const seg of segments) {
    if (current.length + seg.length <= chunkSize) {
      current += seg;
    } else {
      if (current.length > 0) chunks.push(current.trimEnd());
      // If single segment is larger than chunkSize, keep it as-is (will be handled by recursion)
      current = seg;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trimEnd());
  return chunks;
}

function recursiveSplit(text: string, chunkSize: number, sepIndex = 0): string[] {
  if (text.length <= chunkSize) return [text];

  const separator = SEPARATORS[sepIndex];
  if (separator === undefined) {
    // No separator left — hard-split at chunkSize
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  const segments = splitOnSeparator(text, separator);
  if (segments.length <= 1) {
    // Separator not found, try next
    return recursiveSplit(text, chunkSize, sepIndex + 1);
  }

  // Merge small segments back together up to chunkSize
  const merged = mergeSegments(segments, chunkSize);

  // Recursively split any chunk that is still too large
  const result: string[] = [];
  for (const chunk of merged) {
    if (chunk.length > chunkSize) {
      result.push(...recursiveSplit(chunk, chunkSize, sepIndex + 1));
    } else {
      result.push(chunk);
    }
  }
  return result;
}

export class RecursiveCharacterSplitter {
  private chunkSize: number;
  private overlap: number;

  constructor(options: SplitOptions = {}) {
    this.chunkSize = options.chunkSize ?? 512;
    this.overlap = options.overlap ?? 64;
  }

  split(text: string, options: SplitOptions = {}): Chunk[] {
    const chunkSize = options.chunkSize ?? this.chunkSize;
    const overlap = options.overlap ?? this.overlap;
    const metadata = options.metadata ?? {};

    if (!text || text.trim().length === 0) return [];

    const rawChunks = recursiveSplit(text.trim(), chunkSize * 4); // chars, not tokens
    const chunks: Chunk[] = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const rawChunk = rawChunks[i];
      if (!rawChunk) continue;
      let content = rawChunk.trim();

      // Add overlap from previous chunk
      if (i > 0 && overlap > 0) {
        const prev = rawChunks[i - 1];
        if (prev) {
          const overlapText = prev.slice(Math.max(0, prev.length - overlap * 4));
          content = `${overlapText.trim()} ${content}`;
        }
      }

      if (content.length === 0) continue;

      chunks.push({
        content,
        tokenCount: estimateTokens(content),
        index: i,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    }

    return chunks;
  }
}
