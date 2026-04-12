/**
 * Episodic Memory
 *
 * Long-term memory for conversation history and agent memories.
 * Uses ORSet for collection management and PNCounter for access metrics.
 *
 * Key challenge: Bridge ORSet state (which memories exist) with
 * agent_memories table (which stores individual memory records with vectors).
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import { EmbeddingSchema } from '@revealui/contracts/representation';
import type { Database } from '@revealui/db/client';
import { generateEmbedding } from '../../embeddings/index.js';
import type { LWWRegisterData } from '../crdt/lww-register.js';
import { ORSet, type ORSetData } from '../crdt/or-set.js';
import { PNCounter, type PNCounterData } from '../crdt/pn-counter.js';
import type { CRDTPersistence } from '../persistence/crdt-persistence.js';
import { VectorMemoryService, type VectorSearchOptions } from '../vector/vector-memory-service.js';

// =============================================================================
// Types
// =============================================================================

export interface EpisodicMemoryData {
  userId: string;
  nodeId: string;
  memories: ORSetData<string>; // Store memory IDs, not full memory objects
  accessCounter: PNCounterData;
}

// =============================================================================
// Episodic Memory
// =============================================================================

/**
 * Episodic Memory for long-term agent memory storage.
 *
 * @example
 * ```typescript
 * const memory = new EpisodicMemory('user-123', 'node-abc', db, persistence)
 * await memory.load()
 *
 * const memoryId = await memory.add({
 *   id: 'mem-1',
 *   content: 'User prefers dark theme',
 *   type: 'preference',
 *   // ... other fields
 * })
 *
 * const all = memory.getAll()
 * await memory.save()
 * ```
 */
export class EpisodicMemory {
  private memories: ORSet<string>; // Stores memory IDs
  private accessCounter: PNCounter;
  private userId: string;
  private nodeId: string;
  private db: Database; // REST DB for CRDT persistence
  private persistence?: CRDTPersistence;
  private memoryCache: Map<string, AgentMemory> = new Map();
  private vectorService: VectorMemoryService; // Vector DB for memory storage

  /**
   * Creates a new EpisodicMemory instance.
   *
   * @param userId - User identifier
   * @param nodeId - Node identifier (for CRDT operations)
   * @param db - Database client (REST DB for CRDT persistence)
   * @param persistence - Optional persistence adapter
   */
  constructor(userId: string, nodeId: string, db: Database, persistence?: CRDTPersistence) {
    this.userId = userId;
    this.nodeId = nodeId;
    this.db = db;
    this.persistence = persistence;
    this.vectorService = new VectorMemoryService();

    // Initialize CRDTs
    this.memories = new ORSet<string>(nodeId);
    this.accessCounter = new PNCounter(nodeId);
  }

  /**
   * Adds a memory to the collection.
   * Stores the memory in vector database (Supabase) and adds its ID to ORSet.
   *
   * @param memory - Memory to add
   * @returns Tag for this memory addition (for removal)
   */
  async add(memory: AgentMemory): Promise<string> {
    // Validate embedding if provided
    if (memory.embedding) {
      const validationResult = EmbeddingSchema.safeParse(memory.embedding);
      if (!validationResult.success) {
        throw new Error(`Invalid embedding structure: ${validationResult.error.message}`);
      }
    }

    // Store in vector database using VectorMemoryService
    await this.vectorService.create({
      id: memory.id,
      version: memory.version || 1,
      content: memory.content,
      type: memory.type,
      source: memory.source,
      embedding: memory.embedding,
      metadata: memory.metadata,
      accessCount: memory.accessCount || 0,
      verified: memory.verified,
    });

    // Add to ORSet
    const tag = this.memories.add(memory.id);

    // Cache the memory
    this.memoryCache.set(memory.id, memory);

    return tag;
  }

  /**
   * Removes a memory by tag.
   *
   * @param tag - Tag returned from add()
   * @returns true if memory was removed
   */
  remove(tag: string): boolean {
    const removed = this.memories.remove(tag);
    if (removed) {
      // Note: We don't delete from database here - that's a design decision
      // The memory stays in DB for audit/history, but is removed from active set
      // If you want to actually delete, call removeById() instead
    }
    return removed;
  }

  /**
   * Removes a memory by ID (removes all instances).
   * Also deletes from database.
   *
   * @param memoryId - Memory ID to remove
   * @returns Number of instances removed
   */
  async removeById(memoryId: string): Promise<number> {
    // Remove from ORSet
    const entries = this.memories.entries();
    let count = 0;

    for (const [tag, id] of entries) {
      if (id === memoryId) {
        this.memories.remove(tag);
        count++;
      }
    }

    // Delete from vector database
    if (count > 0) {
      await this.vectorService.delete(memoryId);
      this.memoryCache.delete(memoryId);
    }

    return count;
  }

  /**
   * Gets all memory IDs in the set.
   *
   * @returns Array of memory IDs
   */
  getMemoryIds(): string[] {
    return this.memories.values();
  }

  /**
   * Gets all memories (loads from database if not cached).
   *
   * @returns Array of memory objects
   */
  async getAll(): Promise<AgentMemory[]> {
    const ids = this.memories.values();
    const memories: AgentMemory[] = [];

    for (const id of ids) {
      // Check cache first
      const cached = this.memoryCache.get(id);
      if (cached) {
        memories.push(cached);
        continue;
      }

      // Load from vector database
      const memory = await this.vectorService.getById(id);

      if (memory) {
        this.memoryCache.set(id, memory);
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Gets a specific memory by ID.
   *
   * @param memoryId - Memory ID
   * @returns Memory or null if not found
   */
  async get(memoryId: string): Promise<AgentMemory | null> {
    // Check cache
    const cached = this.memoryCache.get(memoryId);
    if (cached) {
      return cached;
    }

    // Check if in ORSet
    if (!this.memories.values().includes(memoryId)) {
      return null;
    }

    // Load from vector database
    const memory = await this.vectorService.getById(memoryId);

    if (memory) {
      this.memoryCache.set(memoryId, memory);
      return memory;
    }

    return null;
  }

  /**
   * Updates a memory by ID.
   * Merges partial data with the current memory, persists to vector store,
   * and refreshes the cache. Eliminates the need for callers to access
   * private fields or instantiate VectorMemoryService directly.
   *
   * @param memoryId - Memory ID to update
   * @param data - Partial memory data to merge
   * @returns Updated memory
   * @throws Error if memory not found in this user's ORSet
   */
  async update(memoryId: string, data: Partial<AgentMemory>): Promise<AgentMemory> {
    if (!this.memories.values().includes(memoryId)) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    const current = this.memoryCache.get(memoryId) ?? (await this.vectorService.getById(memoryId));
    if (!current) {
      throw new Error(`Memory not found in store: ${memoryId}`);
    }

    const merged: AgentMemory = { ...current, ...data, id: memoryId };
    const updated = await this.vectorService.update(memoryId, merged);
    this.memoryCache.set(memoryId, updated);
    return updated;
  }

  /**
   * Increments access counter and updates memory access tracking.
   *
   * @param memoryId - Optional memory ID to track access for
   */
  async incrementAccess(memoryId?: string): Promise<void> {
    this.accessCounter.increment();

    if (memoryId) {
      // Get current memory
      const memory = await this.get(memoryId);

      if (memory) {
        // Update access count in vector database
        await this.vectorService.update(memoryId, {
          accessCount: (memory.accessCount || 0) + 1,
          accessedAt: new Date().toISOString(),
        });

        // Update cache
        const cached = this.memoryCache.get(memoryId);
        if (cached) {
          cached.accessCount = (cached.accessCount || 0) + 1;
          cached.accessedAt = new Date().toISOString();
        }
      }
    }
  }

  /**
   * Gets the total access count.
   *
   * @returns Total access count
   */
  getAccessCount(): number {
    return this.accessCounter.value();
  }

  /**
   * Searches memories using vector similarity search.
   *
   * @param query - Search query text
   * @param options - Search options (limit, threshold, filters)
   * @returns Array of matching memories sorted by relevance
   */
  async search(
    query: string,
    options: Omit<VectorSearchOptions, 'userId'> = {},
  ): Promise<AgentMemory[]> {
    try {
      // Generate embedding for the search query
      const embedding = await generateEmbedding(query);

      // Search for similar memories using vector search
      const results = await this.vectorService.searchSimilar(embedding.vector, {
        ...options,
        limit: options.limit ?? 10,
        threshold: options.threshold ?? 0.5,
      });

      // Return memories sorted by similarity
      return results.map((r) => r.memory);
    } catch (error) {
      // Embedding generation failed (e.g. embedding service unavailable).
      // Return empty results  -  do NOT fall back to getAll(), which would dump the
      // entire memory store into agent context regardless of relevance.
      void (error instanceof Error ? error.message : String(error)); // Semantic search failed  -  return empty results
      return [];
    }
  }

  /**
   * Merges another EpisodicMemory into this one.
   *
   * @param other - EpisodicMemory to merge
   * @returns New merged EpisodicMemory
   */
  merge(other: EpisodicMemory): EpisodicMemory {
    const merged = new EpisodicMemory(this.userId, this.nodeId, this.db, this.persistence);
    merged.memories = this.memories.merge(other.memories);
    merged.accessCounter = this.accessCounter.merge(other.accessCounter);
    return merged;
  }

  /**
   * Loads state from database.
   *
   * @throws Error if persistence is not configured
   */
  async load(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not configured. Pass persistence to constructor.');
    }

    const crdtId = `episodic-memory:${this.userId}`;
    const states = await this.persistence.loadCompositeState(crdtId);

    // Restore memories ORSet
    const memoriesData = states.get('or_set:memories');
    if (memoriesData && 'added' in memoriesData) {
      this.memories = ORSet.fromData<string>(memoriesData as ORSetData<string>);
    }

    // Restore access counter
    const counterData = states.get('pn_counter:access');
    if (counterData && 'increments' in counterData) {
      this.accessCounter = PNCounter.fromData(counterData);
    }

    // Preload memory cache
    const ids = this.memories.values();
    for (const id of ids.slice(0, 100)) {
      // Load first 100 into cache
      await this.get(id);
    }
  }

  /**
   * Saves state to database.
   *
   * @throws Error if persistence is not configured
   */
  async save(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not configured. Pass persistence to constructor.');
    }

    const crdtId = `episodic-memory:${this.userId}`;
    const states = new Map<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>();

    states.set('or_set:memories', this.memories.toData());
    states.set('pn_counter:access', this.accessCounter.toData());

    await this.persistence.saveCompositeState(crdtId, states);
  }

  /**
   * Serializes EpisodicMemory to plain object.
   *
   * @returns Serialized data
   */
  toData(): EpisodicMemoryData {
    return {
      userId: this.userId,
      nodeId: this.nodeId,
      memories: this.memories.toData(),
      accessCounter: this.accessCounter.toData(),
    };
  }

  /**
   * Deserializes EpisodicMemory from plain object.
   *
   * @param data - Serialized data
   * @param db - Database client
   * @param persistence - Optional persistence adapter
   * @returns New EpisodicMemory instance
   */
  static fromData(
    data: EpisodicMemoryData,
    db: Database,
    persistence?: CRDTPersistence,
  ): EpisodicMemory {
    const memory = new EpisodicMemory(data.userId, data.nodeId, db, persistence);
    memory.memories = ORSet.fromData<string>(data.memories);
    memory.accessCounter = PNCounter.fromData(data.accessCounter);
    return memory;
  }

  /**
   * Creates a copy of this EpisodicMemory.
   *
   * @returns New EpisodicMemory with same state
   */
  clone(): EpisodicMemory {
    return EpisodicMemory.fromData(this.toData(), this.db, this.persistence);
  }

  /**
   * Gets the user ID.
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Gets the node ID.
   */
  getNodeId(): string {
    return this.nodeId;
  }
}
