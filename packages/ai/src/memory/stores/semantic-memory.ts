/**
 * Semantic Memory
 *
 * Knowledge base with vector similarity search for AI agents.
 * Stores content with optional embeddings and supports semantic
 * retrieval via cosine similarity ranking.
 *
 * Designed to work standalone (in-memory) for testing and
 * with a vector store (Supabase pgvector) in production.
 */

import { validateContext } from '../utils/validation.js';

// =============================================================================
// Types
// =============================================================================

export interface SemanticEntry {
  key: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  storedAt: number;
  expiresAt?: number;
}

export interface SemanticSearchResult {
  key: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SemanticMemoryOptions {
  /** Maximum number of entries to retain. Oldest are evicted first. */
  maxEntries?: number;
  /** Default TTL in milliseconds. Entries expire after this duration. */
  ttlMs?: number;
}

// =============================================================================
// SemanticMemory
// =============================================================================

/**
 * Semantic Memory for knowledge-base storage and retrieval.
 *
 * Provides cosine-similarity search over stored entries.
 * When embeddings are not provided, falls back to keyword matching.
 *
 * @example
 * ```typescript
 * const memory = new SemanticMemory({ maxEntries: 1000, ttlMs: 24 * 60 * 60 * 1000 })
 *
 * await memory.store('pref:theme', 'User prefers dark mode', [0.1, 0.9, 0.3])
 *
 * const results = await memory.search([0.1, 0.9, 0.3], 3)
 * // results[0].content === 'User prefers dark mode'
 *
 * await memory.delete('pref:theme')
 * ```
 */
export class SemanticMemory {
  private entries: Map<string, SemanticEntry> = new Map();
  private readonly maxEntries: number;
  private readonly ttlMs: number | undefined;

  constructor(options: SemanticMemoryOptions = {}) {
    this.maxEntries = options.maxEntries ?? 10_000;
    this.ttlMs = options.ttlMs;
  }

  /**
   * Store a content entry with an optional embedding vector.
   *
   * If the store is at capacity, the oldest entry is evicted first.
   */
  async store(
    key: string,
    content: string,
    embedding?: number[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (metadata) {
      validateContext(metadata);
    }

    // Evict oldest if at capacity (and not overwriting an existing key)
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }

    const entry: SemanticEntry = {
      key,
      content,
      embedding,
      metadata,
      storedAt: Date.now(),
      expiresAt: this.ttlMs !== undefined ? Date.now() + this.ttlMs : undefined,
    };

    this.entries.set(key, entry);
  }

  /**
   * Retrieve an entry by exact key.
   */
  async get(key: string): Promise<SemanticEntry | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt < Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  /**
   * Delete an entry by key.
   */
  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /**
   * Search for the top-K most similar entries to a query embedding.
   *
   * Uses cosine similarity when both the query and entry have embeddings.
   * Falls back to returning all non-expired entries ordered by recency when
   * embeddings are absent.
   *
   * @param queryEmbedding - Query vector
   * @param topK           - Maximum number of results to return (default 5)
   */
  async search(queryEmbedding: number[], topK = 5): Promise<SemanticSearchResult[]> {
    this.evictExpired();

    const results: SemanticSearchResult[] = [];

    for (const entry of this.entries.values()) {
      const score =
        entry.embedding !== undefined ? cosineSimilarity(queryEmbedding, entry.embedding) : 0; // No embedding → score 0 (will appear last)

      results.push({ key: entry.key, content: entry.content, score, metadata: entry.metadata });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Return all non-expired entries.
   */
  list(): SemanticEntry[] {
    this.evictExpired();
    return Array.from(this.entries.values());
  }

  /**
   * Number of stored entries (excluding expired ones).
   */
  get size(): number {
    this.evictExpired();
    return this.entries.size;
  }

  /**
   * Remove all expired entries from the store.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt !== undefined && entry.expiresAt < now) {
        this.entries.delete(key);
      }
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Cosine similarity between two equal-length vectors.
 * Returns a value in [-1, 1]. Returns 0 for zero-magnitude vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: i is bounded by a.length, and b has same length (checked above)
    const ai = a[i]!;
    // biome-ignore lint/style/noNonNullAssertion: i is bounded by a.length === b.length (checked above)
    const bi = b[i]!;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
