/**
 * RAG Query  -  Retrieval-Augmented Generation
 *
 * Generates an embedding for the query, searches the rag_chunks table via
 * pgvector cosine distance, assembles ranked context with recency weighting,
 * and optionally compresses it if it exceeds the token budget.
 */

import type { Database } from '@revealui/db/client';
import { generateEmbedding } from '../embeddings/index.js';
import { hybridSearch } from '../ingestion/hybrid-search.js';
import type { LLMClient } from '../llm/client.js';
import { assembleContext } from './context-assembly.js';
import { compressContext } from './overflow-compressor.js';

export interface RAGOptions {
  workspaceId: string;
  db: Database;
  /** Maximum search results to retrieve (default 5) */
  limit?: number;
  /** Minimum cosine similarity threshold 0–1 (default 0.6) */
  threshold?: number;
  /** Custom embedding function  -  defaults to generateEmbedding() */
  embeddingFn?: (text: string) => Promise<number[]>;
  /** search mode: 'speed' (vector-only) | 'accuracy' (BM25 hybrid + optional rerank) */
  mode?: 'speed' | 'accuracy';
  /** LLMClient for accuracy-mode reranking and overflow compression */
  llmClient?: LLMClient;
  /** Maximum tokens for assembled context (default 2000) */
  maxContextTokens?: number;
  /** Filter to a specific admin collection */
  sourceCollection?: string;
}

/**
 * Run RAG retrieval for a query.
 *
 * Returns a formatted context string ready to prepend to an LLM prompt.
 * Returns '' if no relevant documents exist for the workspace.
 */
export async function runRAG(query: string, options?: RAGOptions): Promise<string> {
  if (!(query?.trim() && options)) return '';

  const embeddingFn =
    options.embeddingFn ??
    (async (text: string) => {
      const emb = await generateEmbedding(text);
      return emb.vector;
    });

  const maxContextTokens = options.maxContextTokens ?? 2000;

  // Retrieve relevant chunks
  const results = await hybridSearch(query, options.db, embeddingFn, {
    workspaceId: options.workspaceId,
    limit: options.limit ?? 5,
    threshold: options.threshold ?? 0.6,
    mode: options.mode ?? 'speed',
    sourceCollection: options.sourceCollection,
    llmClient: options.llmClient,
    rerank: options.mode === 'accuracy' && options.llmClient !== undefined,
  });

  if (results.length === 0) return '';

  // Assemble context with recency + relevance blending
  const context = assembleContext(results, {
    maxTokens: maxContextTokens,
    relevanceWeight: 0.7,
    recencyWeight: 0.3,
  });

  // Auto-compress if over budget and LLMClient available
  if (options.llmClient) {
    return compressContext(context, {
      maxTokens: maxContextTokens,
      llmClient: options.llmClient,
    });
  }

  return context;
}
