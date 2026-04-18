/**
 * Vector Memory Service
 *
 * Service for managing agent memories in Supabase with vector search capabilities.
 * Uses pgvector for semantic similarity search.
 *
 * @example
 * ```typescript
 * import { VectorMemoryService } from '@revealui/ai/memory/vector/vector-memory-service'
 *
 * const service = new VectorMemoryService()
 * const memories = await service.searchSimilar(embedding, { siteId: 'site-123', limit: 10 })
 * ```
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import { getRestClient, getVectorClient } from '@revealui/db/client';
import { agentMemories } from '@revealui/db/schema';
import { assertCrossDbRefs, safeVectorInsert } from '@revealui/db/validation';
import { and, eq, type SQL, sql } from 'drizzle-orm';

export interface VectorSearchOptions {
  userId?: string;
  siteId?: string;
  agentId?: string;
  type?: string;
  limit?: number;
  threshold?: number; // Minimum similarity threshold (0-1)
}

export interface VectorSearchResult {
  memory: AgentMemory;
  similarity: number; // Cosine similarity score (0-1, higher is more similar)
}

/**
 * Vector Memory Service for semantic search operations.
 */
export class VectorMemoryService {
  private _db: ReturnType<typeof getVectorClient> | null = null;
  private _restDb: ReturnType<typeof getRestClient> | null = null;

  /**
   * Lazy-load database client to avoid connection initialization at module import time.
   * This allows the module to be imported in test environments without triggering database connections.
   */
  private get db(): ReturnType<typeof getVectorClient> {
    if (!this._db) {
      this._db = getVectorClient();
    }
    return this._db;
  }

  /** Lazy-load REST client for cross-DB reference validation. */
  private get restDb(): ReturnType<typeof getRestClient> {
    if (!this._restDb) {
      this._restDb = getRestClient();
    }
    return this._restDb;
  }

  /**
   * Search for similar memories using vector similarity.
   *
   * @param queryEmbedding - Query embedding vector (768 dimensions  -  Ollama nomic-embed-text)
   * @param options - Search options (filtering, limits, etc.)
   * @returns Array of memories with similarity scores, sorted by similarity (highest first)
   *
   * @example
   * ```typescript
   * const embedding = await generateEmbedding('user prefers dark theme')
   * const results = await service.searchSimilar(embedding, {
   *   siteId: 'site-123',
   *   limit: 10,
   *   threshold: 0.7
   * })
   * ```
   */
  async searchSimilar(
    queryEmbedding: number[],
    options: VectorSearchOptions = {},
  ): Promise<VectorSearchResult[]> {
    // Validate embedding dimensions
    if (queryEmbedding.length !== 768) {
      throw new Error(`Invalid embedding dimension: expected 768, got ${queryEmbedding.length}`);
    }

    // Build where conditions
    const conditions: SQL[] = [];
    if (options.siteId) {
      conditions.push(eq(agentMemories.siteId, options.siteId));
    }
    if (options.agentId) {
      conditions.push(eq(agentMemories.agentId, options.agentId));
    }
    if (options.type) {
      conditions.push(eq(agentMemories.type, options.type));
    }

    // Build query with vector similarity
    // Using cosine distance (<->) operator from pgvector
    // 1 - distance = similarity (higher is better)
    const query = this.db
      .select({
        id: agentMemories.id,
        version: agentMemories.version,
        content: agentMemories.content,
        type: agentMemories.type,
        source: agentMemories.source,
        embedding: agentMemories.embedding,
        embeddingMetadata: agentMemories.embeddingMetadata,
        metadata: agentMemories.metadata,
        accessCount: agentMemories.accessCount,
        accessedAt: agentMemories.accessedAt,
        verified: agentMemories.verified,
        verifiedBy: agentMemories.verifiedBy,
        verifiedAt: agentMemories.verifiedAt,
        siteId: agentMemories.siteId,
        agentId: agentMemories.agentId,
        createdAt: agentMemories.createdAt,
        expiresAt: agentMemories.expiresAt,
        // Calculate similarity: 1 - cosine_distance
        // Cosine distance returns 0-2, where 0 is identical
        // We convert to similarity: 1 - (distance / 2) gives us 0-1 range
        similarity: sql<number>`1 - (embedding <-> ${JSON.stringify(queryEmbedding)}::vector) / 2`,
      })
      .from(agentMemories)
      .where(
        and(
          // Only search memories with embeddings
          sql`embedding IS NOT NULL`,
          // Apply filters
          ...conditions,
          // Apply similarity threshold if provided
          options.threshold !== undefined
            ? sql`1 - (embedding <-> ${JSON.stringify(queryEmbedding)}::vector) / 2 >= ${options.threshold}`
            : undefined,
        ),
      )
      .orderBy(sql`embedding <-> ${JSON.stringify(queryEmbedding)}::vector`)
      .limit(options.limit ?? 10);

    const results = await query;

    // Transform results to match AgentMemory schema
    return results.map((row) => {
      // Convert embedding from string format to number array if needed
      let embedding: AgentMemory['embedding'];
      if (row.embedding) {
        // Embedding is stored as vector type, Drizzle should handle conversion
        // But we need to construct the Embedding object
        const embeddingMetadata = row.embeddingMetadata as {
          model: string;
          dimension: number;
          generatedAt: string;
        } | null;

        if (embeddingMetadata) {
          embedding = {
            vector: Array.isArray(row.embedding) ? row.embedding : [],
            model: embeddingMetadata.model,
            dimension: embeddingMetadata.dimension,
            generatedAt: embeddingMetadata.generatedAt,
          };
        }
      }

      const memory: AgentMemory = {
        id: row.id,
        version: row.version,
        content: row.content,
        type: row.type as AgentMemory['type'],
        source: row.source as AgentMemory['source'],
        embedding,
        metadata: (row.metadata as AgentMemory['metadata']) || {},
        accessCount: row.accessCount || 0,
        accessedAt: row.accessedAt?.toISOString() || new Date().toISOString(),
        verified: row.verified ?? false,
        createdAt: row.createdAt.toISOString(),
      };

      return {
        memory,
        similarity: row.similarity || 0,
      };
    });
  }

  /**
   * Create a new memory in the vector database.
   *
   * @param memory - Memory to create (without id, createdAt, accessedAt)
   * @returns Created memory with generated id and timestamps
   */
  async create(
    memory: Omit<AgentMemory, 'id' | 'createdAt' | 'accessedAt'> & {
      id?: string;
    },
  ): Promise<AgentMemory> {
    const id = memory.id || crypto.randomUUID();
    const now = new Date();

    // Pass embedding vector directly - Drizzle's vector type will handle conversion
    // The vector custom type has toDriver() that converts number[] to string format
    const embeddingVector = memory.embedding?.vector || null;
    const siteId = memory.metadata?.siteId;
    if (!siteId) {
      throw new Error('siteId is required to create an agent memory');
    }

    const result = await safeVectorInsert(
      this.restDb,
      async () =>
        this.db
          .insert(agentMemories)
          .values({
            id,
            version: memory.version || 1,
            content: memory.content,
            type: memory.type,
            source: memory.source,
            embedding: embeddingVector,
            embeddingMetadata: memory.embedding || null,
            metadata: memory.metadata || {},
            accessCount: 0,
            accessedAt: now,
            verified: memory.verified,
            verifiedBy: null, // Can be set via update
            verifiedAt: null,
            siteId,
            agentId: (memory.metadata?.custom?.agentId as string | undefined) || null,
            createdAt: now,
            expiresAt: memory.metadata?.expiresAt ? new Date(memory.metadata.expiresAt) : null,
          })
          .returning(),
      { siteId: siteId ?? undefined },
    );

    const row = result[0];
    if (!row) {
      throw new Error('Failed to create memory');
    }

    // Convert back to AgentMemory format
    let embedding: AgentMemory['embedding'];
    if (row.embeddingMetadata) {
      const metadata = row.embeddingMetadata as {
        model: string;
        dimension: number;
        generatedAt: string;
      };
      embedding = {
        vector: Array.isArray(row.embedding) ? row.embedding : [],
        model: metadata.model,
        dimension: metadata.dimension,
        generatedAt: metadata.generatedAt,
      };
    }

    return {
      id: row.id,
      version: row.version,
      content: row.content,
      type: row.type as AgentMemory['type'],
      source: row.source as AgentMemory['source'],
      embedding,
      metadata: (row.metadata as AgentMemory['metadata']) || {},
      accessCount: row.accessCount || 0,
      accessedAt: row.accessedAt?.toISOString() || now.toISOString(),
      verified: row.verified ?? false,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Update an existing memory.
   *
   * @param id - Memory ID
   * @param updates - Partial memory updates
   * @returns Updated memory
   */
  async update(
    id: string,
    updates: Partial<Omit<AgentMemory, 'id' | 'createdAt'>>,
  ): Promise<AgentMemory> {
    const updateData: Record<string, unknown> = {};

    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    if (updates.verified !== undefined) updateData.verified = updates.verified;
    if (updates.accessCount !== undefined) updateData.accessCount = updates.accessCount;
    if (updates.accessedAt !== undefined) updateData.accessedAt = new Date(updates.accessedAt);

    // Handle embedding update
    // Pass vector directly - Drizzle's vector type will handle conversion
    if (updates.embedding !== undefined) {
      if (updates.embedding) {
        updateData.embedding = updates.embedding.vector; // number[] - Drizzle converts to string
        updateData.embeddingMetadata = updates.embedding;
      } else {
        updateData.embedding = null;
        updateData.embeddingMetadata = null;
      }
    }

    // Update siteId and agentId from metadata if provided
    if (updates.metadata?.siteId !== undefined) {
      updateData.siteId = updates.metadata.siteId || null;
    }
    if (updates.metadata?.custom?.agentId !== undefined) {
      updateData.agentId = (updates.metadata.custom.agentId as string) || null;
    }

    // Validate cross-DB references if FK fields are changing
    const newSiteId = updateData.siteId as string | undefined;
    const newVerifiedBy = updates.verified
      ? (updates.metadata?.verifiedBy as string | undefined)
      : undefined;
    if (newSiteId || newVerifiedBy) {
      await assertCrossDbRefs(this.restDb, {
        siteId: newSiteId || undefined,
        userId: newVerifiedBy || undefined,
      });
    }

    const result = await this.db
      .update(agentMemories)
      .set(updateData)
      .where(eq(agentMemories.id, id))
      .returning();

    const row = result[0];
    if (!row) {
      throw new Error(`Memory not found: ${id}`);
    }

    // Convert back to AgentMemory format
    let embedding: AgentMemory['embedding'];
    if (row.embeddingMetadata) {
      const metadata = row.embeddingMetadata as {
        model: string;
        dimension: number;
        generatedAt: string;
      };
      embedding = {
        vector: Array.isArray(row.embedding) ? row.embedding : [],
        model: metadata.model,
        dimension: metadata.dimension,
        generatedAt: metadata.generatedAt,
      };
    }

    return {
      id: row.id,
      version: row.version,
      content: row.content,
      type: row.type as AgentMemory['type'],
      source: row.source as AgentMemory['source'],
      embedding,
      metadata: (row.metadata as AgentMemory['metadata']) || {},
      accessCount: row.accessCount || 0,
      accessedAt: row.accessedAt?.toISOString() || new Date().toISOString(),
      verified: row.verified ?? false,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Delete a memory by ID.
   *
   * @param id - Memory ID to delete
   * @returns true if memory was deleted
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(agentMemories).where(eq(agentMemories.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Get a memory by ID.
   *
   * @param id - Memory ID
   * @returns Memory if found, null otherwise
   */
  async getById(id: string): Promise<AgentMemory | null> {
    const result = await this.db
      .select()
      .from(agentMemories)
      .where(eq(agentMemories.id, id))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    if (!row) {
      return null;
    }

    // Convert to AgentMemory format
    let embedding: AgentMemory['embedding'];
    if (row.embeddingMetadata) {
      const metadata = row.embeddingMetadata as {
        model: string;
        dimension: number;
        generatedAt: string;
      };
      embedding = {
        vector: Array.isArray(row.embedding) ? row.embedding : [],
        model: metadata.model,
        dimension: metadata.dimension,
        generatedAt: metadata.generatedAt,
      };
    }

    return {
      id: row.id,
      version: row.version,
      content: row.content,
      type: row.type as AgentMemory['type'],
      source: row.source as AgentMemory['source'],
      embedding,
      metadata: (row.metadata as AgentMemory['metadata']) || {},
      accessCount: row.accessCount || 0,
      accessedAt: row.accessedAt?.toISOString() || new Date().toISOString(),
      verified: row.verified ?? false,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
