/**
 * Embedding backfill — strictly best-effort, degrades gracefully.
 *
 * When an `Embedder` is provided (wired to `@revealui/ai` `generateEmbedding`,
 * nomic-embed-text/768), node and edge embeddings are computed and stored. If
 * the embedder throws (Ollama down) or the target lacks pgvector, the row keeps
 * its NULL embedding and ingestion proceeds — backfill is deferred, never fatal.
 */

import type { Embedder, KgExecutor } from '../types.js';

/** pgvector text literal: `[1,2,3]`. */
function formatVector(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

async function backfill(
  exec: KgExecutor,
  embedder: Embedder,
  table: 'kg_nodes' | 'kg_edges',
  id: string,
  text: string,
): Promise<void> {
  if (!text.trim()) return;
  try {
    const vector = await embedder(text);
    if (!Array.isArray(vector) || vector.length === 0) return;
    await exec.query(`UPDATE ${table} SET embedding = $2::vector WHERE id = $1`, [
      id,
      formatVector(vector),
    ]);
  } catch {
    // Ollama unavailable or no pgvector — leave embedding NULL for later backfill.
  }
}

export async function backfillNodeEmbedding(
  exec: KgExecutor,
  embedder: Embedder,
  id: string,
  text: string,
): Promise<void> {
  await backfill(exec, embedder, 'kg_nodes', id, text);
}

export async function backfillEdgeEmbedding(
  exec: KgExecutor,
  embedder: Embedder,
  id: string,
  text: string,
): Promise<void> {
  await backfill(exec, embedder, 'kg_edges', id, text);
}
