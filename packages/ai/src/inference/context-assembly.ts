/**
 * Context Assembly with Smart Trimming
 *
 * Blends relevance (cosine similarity) and recency (createdAt) to rank chunks,
 * then greedily assembles them up to a token budget.
 * Auto-compresses single chunks that exceed half the budget.
 *
 * AnythingLLM lesson: plain cosine-only retrieval without recency weighting
 * produces stale, misleading context in long-running knowledge bases.
 */

import type { RagSearchResult } from '../ingestion/rag-vector-service.js';

export interface AssembleContextOptions {
  /** Maximum token budget for the assembled context */
  maxTokens: number;
  /** Weight for recency score (default 0.3) */
  recencyWeight?: number;
  /** Weight for cosine similarity (default 0.7) */
  relevanceWeight?: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compute a 0–1 recency score: newest chunk = 1.0, oldest = 0.1.
 * Decays linearly based on position in time-sorted array.
 */
function computeRecencyScores(results: RagSearchResult[]): Map<string, number> {
  if (results.length === 0) return new Map();
  if (results.length === 1) {
    const r = results[0];
    return r ? new Map([[r.chunk.id, 1.0]]) : new Map();
  }

  const sorted = [...results].sort(
    (a, b) => b.chunk.createdAt.getTime() - a.chunk.createdAt.getTime(),
  );

  const map = new Map<string, number>();
  const n = sorted.length;
  sorted.forEach((r, i) => {
    // Linearly decay from 1.0 (newest) to 0.1 (oldest)
    const score = 1.0 - (0.9 * i) / Math.max(n - 1, 1);
    map.set(r.chunk.id, score);
  });
  return map;
}

/**
 * Assemble RAG context from search results.
 *
 * Returns a formatted string of numbered references, trimmed to maxTokens.
 * Returns '' if results is empty.
 */
export function assembleContext(
  results: RagSearchResult[],
  options: AssembleContextOptions,
): string {
  if (results.length === 0) return '';

  const relevanceWeight = options.relevanceWeight ?? 0.7;
  const recencyWeight = options.recencyWeight ?? 0.3;
  const maxTokens = options.maxTokens;

  const recencyScores = computeRecencyScores(results);

  // Compute blended scores
  const scored = results.map((r) => {
    const recency = recencyScores.get(r.chunk.id) ?? 0.5;
    const finalScore = r.similarity * relevanceWeight + recency * recencyWeight;
    return { result: r, finalScore };
  });

  // Sort descending by blended score
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Greedy token-budget assembly
  const sections: string[] = [];
  let usedTokens = 0;
  const halfBudget = Math.floor(maxTokens / 2);

  for (let i = 0; i < scored.length; i++) {
    const item = scored[i];
    if (!item) continue;

    const { result } = item;
    const title = result.document.title ?? result.document.sourceCollection ?? 'Unknown';
    let content = result.chunk.content;

    // Auto-compress: if single chunk exceeds half the budget, truncate
    const chunkTokens = estimateTokens(content);
    if (chunkTokens > halfBudget) {
      const maxChars = halfBudget * 4;
      content = `${content.slice(0, maxChars)} [content truncated]`;
    }

    const section = `[${i + 1}] Source: ${title}\n${content}`;
    const sectionTokens = estimateTokens(section);

    if (usedTokens + sectionTokens > maxTokens) break;

    sections.push(section);
    usedTokens += sectionTokens;
  }

  return sections.join('\n\n---\n\n');
}
