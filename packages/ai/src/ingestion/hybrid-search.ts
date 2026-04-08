/**
 * Hybrid Search — Vector + BM25 with Reciprocal Rank Fusion
 *
 * speed mode: cosine vector search only (fast, default)
 * accuracy mode: fetch 50 vector candidates → BM25 on those → RRF fusion → optional LLM rerank
 *
 * RRF formula: score(d) = Σ 1 / (k + rank(d))  where k = 60
 */

import type { Database } from '@revealui/db/client';
import type { LLMClient } from '../llm/client.js';
import { BM25 } from './bm25.js';
import type { RagSearchOptions, RagSearchResult } from './rag-vector-service.js';
import { RagVectorService } from './rag-vector-service.js';
import { rerankChunks } from './reranker.js';

export interface HybridSearchOptions extends RagSearchOptions {
  /** speed = vector only, accuracy = BM25 hybrid + optional rerank (default: 'speed') */
  mode?: 'speed' | 'accuracy';
  /** Number of vector candidates to fetch before BM25 filtering (accuracy mode only) */
  vectorCandidates?: number;
  /** Whether to apply LLM re-ranking in accuracy mode (default: false) */
  rerank?: boolean;
  llmClient?: LLMClient;
}

const RRF_K = 60;

export async function hybridSearch(
  query: string,
  _db: Database,
  embeddingFn: (text: string) => Promise<number[]>,
  options: HybridSearchOptions,
): Promise<RagSearchResult[]> {
  const service = new RagVectorService();
  const mode = options.mode ?? 'speed';
  const limit = options.limit ?? 5;

  // Speed mode: pure vector search
  if (mode === 'speed') {
    const embedding = await embeddingFn(query);
    return service.searchSimilar(embedding, { ...options, limit });
  }

  // Accuracy mode: over-fetch vector candidates, BM25 on them, RRF fusion
  const candidateCount = options.vectorCandidates ?? 50;
  const embedding = await embeddingFn(query);

  const vectorResults = await service.searchSimilar(embedding, {
    ...options,
    limit: candidateCount,
    threshold: 0.3, // lower threshold to get more candidates
  });

  if (vectorResults.length === 0) return [];

  // Build BM25 index from vector candidates
  const bm25 = new BM25();
  bm25.index(
    vectorResults.map((r) => ({
      id: r.chunk.id,
      text: r.chunk.content,
    })),
  );

  const bm25Results = bm25.search(query, candidateCount);

  // Build rank maps
  const vectorRankMap = new Map(vectorResults.map((r, i) => [r.chunk.id, i + 1]));
  const bm25RankMap = new Map(bm25Results.map((r, i) => [r.id, i + 1]));

  // RRF fusion
  const allIds = new Set([...vectorRankMap.keys(), ...bm25RankMap.keys()]);
  const rrfScores = new Map<string, number>();

  for (const id of allIds) {
    const vectorRank = vectorRankMap.get(id) ?? candidateCount + 1;
    const bm25Rank = bm25RankMap.get(id) ?? candidateCount + 1;
    const rrf = 1 / (RRF_K + vectorRank) + 1 / (RRF_K + bm25Rank);
    rrfScores.set(id, rrf);
  }

  // Sort by RRF score and map back to RagSearchResult
  const resultMap = new Map(vectorResults.map((r) => [r.chunk.id, r]));
  const sorted = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => resultMap.get(id))
    .filter((r): r is RagSearchResult => r !== undefined);

  // Optional LLM re-ranking
  if (options.rerank && options.llmClient) {
    return rerankChunks(query, sorted, options.llmClient, limit);
  }

  return sorted;
}
