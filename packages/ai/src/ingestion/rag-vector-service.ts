/**
 * RAG Vector Service
 *
 * Semantic similarity search over rag_chunks using pgvector cosine distance.
 * Modeled after VectorMemoryService — same Drizzle cosine-distance pattern.
 */

import { getVectorClient } from '@revealui/db/client';
import type { RagChunk, RagDocument } from '@revealui/db/schema/rag';
import { ragChunks, ragDocuments } from '@revealui/db/schema/rag';
import { and, asc, eq, type SQL, sql } from 'drizzle-orm';

export interface RagSearchOptions {
  workspaceId: string;
  limit?: number; // default 5
  threshold?: number; // minimum similarity 0–1 (default 0.6)
  sourceCollection?: string; // filter by admin collection
}

export interface RagSearchResult {
  chunk: RagChunk;
  document: Pick<
    RagDocument,
    'id' | 'title' | 'sourceType' | 'sourceCollection' | 'sourceId' | 'createdAt'
  >;
  similarity: number;
}

export class RagVectorService {
  private _db: ReturnType<typeof getVectorClient> | null = null;

  private get db(): ReturnType<typeof getVectorClient> {
    if (!this._db) {
      this._db = getVectorClient();
    }
    return this._db;
  }

  /**
   * Search for RAG chunks similar to the query embedding.
   *
   * Uses cosine distance (<->) from pgvector.
   * Validates that the embedding is 768-dimensional (nomic-embed-text).
   */
  async searchSimilar(
    queryEmbedding: number[],
    options: RagSearchOptions,
  ): Promise<RagSearchResult[]> {
    if (queryEmbedding.length !== 768) {
      throw new Error(
        `Invalid embedding dimension: expected 768, got ${queryEmbedding.length}. ` +
          'RAG uses nomic-embed-text (768-dim). Ensure OLLAMA_BASE_URL is set.',
      );
    }

    const conditions: SQL[] = [
      sql`${ragChunks}.embedding IS NOT NULL`,
      eq(ragChunks.workspaceId, options.workspaceId),
    ];

    if (options.sourceCollection) {
      conditions.push(eq(ragDocuments.sourceCollection, options.sourceCollection));
    }

    const threshold = options.threshold ?? 0.6;
    const limit = options.limit ?? 5;

    const embeddingJson = JSON.stringify(queryEmbedding);

    const rows = await this.db
      .select({
        chunkId: ragChunks.id,
        documentId: ragChunks.documentId,
        workspaceId: ragChunks.workspaceId,
        content: ragChunks.content,
        tokenCount: ragChunks.tokenCount,
        chunkIndex: ragChunks.chunkIndex,
        embedding: ragChunks.embedding,
        embeddingModel: ragChunks.embeddingModel,
        metadata: ragChunks.metadata,
        chunkCreatedAt: ragChunks.createdAt,
        docTitle: ragDocuments.title,
        docSourceType: ragDocuments.sourceType,
        docSourceCollection: ragDocuments.sourceCollection,
        docSourceId: ragDocuments.sourceId,
        docCreatedAt: ragDocuments.createdAt,
        // 1 - (cosine_distance / 2) maps [0,2] distance to [0,1] similarity
        similarity: sql<number>`1 - (${ragChunks}.embedding <-> ${embeddingJson}::vector) / 2`,
      })
      .from(ragChunks)
      .innerJoin(ragDocuments, eq(ragChunks.documentId, ragDocuments.id))
      .where(
        and(
          ...conditions,
          sql`1 - (${ragChunks}.embedding <-> ${embeddingJson}::vector) / 2 >= ${threshold}`,
        ),
      )
      .orderBy(sql`${ragChunks}.embedding <-> ${embeddingJson}::vector`)
      .limit(limit);

    return rows.map((row) => ({
      chunk: {
        id: row.chunkId,
        documentId: row.documentId,
        workspaceId: row.workspaceId,
        content: row.content,
        tokenCount: row.tokenCount,
        chunkIndex: row.chunkIndex,
        embedding: row.embedding,
        embeddingModel: row.embeddingModel,
        metadata: row.metadata,
        createdAt: row.chunkCreatedAt,
      } satisfies RagChunk,
      document: {
        id: row.documentId,
        title: row.docTitle,
        sourceType: row.docSourceType,
        sourceCollection: row.docSourceCollection,
        sourceId: row.docSourceId,
        createdAt: row.docCreatedAt,
      },
      similarity: row.similarity ?? 0,
    }));
  }

  /**
   * Get all chunks for a document ordered by chunk index.
   */
  async getChunksByDocument(documentId: string): Promise<RagChunk[]> {
    return this.db
      .select()
      .from(ragChunks)
      .where(eq(ragChunks.documentId, documentId))
      .orderBy(asc(ragChunks.chunkIndex));
  }
}
