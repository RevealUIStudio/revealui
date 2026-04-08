/**
 * LLM-based Re-ranker
 *
 * Scores chunks 0–10 for relevance to the query using the configured LLMClient.
 * No cross-encoder model required — uses the existing LLM.
 */

import type { LLMClient } from '../llm/client.js';
import type { RagSearchResult } from './rag-vector-service.js';

const RERANK_SYSTEM_PROMPT = `You are a relevance judge. Given a query and a list of passages, score each passage for relevance to the query on a scale of 0 to 10 (0=not relevant, 10=perfectly relevant). Return ONLY a JSON array of numbers, one score per passage, in the same order as the input. Example: [8, 3, 10, 1]`;

export async function rerankChunks(
  query: string,
  chunks: RagSearchResult[],
  llmClient: LLMClient,
  topK?: number,
): Promise<RagSearchResult[]> {
  if (chunks.length === 0) return [];

  const passageList = chunks
    .map((r, i) => `[${i + 1}] ${r.chunk.content.slice(0, 400)}`)
    .join('\n\n');

  const userMessage = `Query: ${query}\n\nPassages:\n${passageList}\n\nReturn a JSON array of ${chunks.length} relevance scores (0-10).`;

  try {
    const response = await llmClient.chat([
      { role: 'system', content: RERANK_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ]);

    // Extract JSON array from response
    const match = response.content.match(/\[[\d\s,]+\]/);
    if (!match) return chunks.slice(0, topK);

    const scores = JSON.parse(match[0]) as unknown[];
    if (!Array.isArray(scores) || scores.length !== chunks.length) {
      return chunks.slice(0, topK);
    }

    const scored = chunks.map((chunk, i) => ({
      chunk,
      score: typeof scores[i] === 'number' ? (scores[i] as number) : 0,
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK ?? chunks.length)
      .map((s) => s.chunk);
  } catch {
    // On LLM failure, return original order
    return chunks.slice(0, topK);
  }
}
