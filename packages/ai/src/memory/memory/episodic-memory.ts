/**
 * Episodic Memory
 *
 * Long-term memory for conversation history and agent memories.
 * Uses ORSet for collection management and PNCounter for access metrics.
 *
 * Key challenge: Bridge ORSet state (which memories exist) with
 * agent_memories table (which stores individual memory records with vectors).
 */

import type { Database } from '@revealui/db/client'
import { agentMemories, eq } from '@revealui/db/core'
import type { AgentMemory } from '@revealui/schema/agents'
import type { Embedding } from '@revealui/schema/representation'
import { EmbeddingSchema } from '@revealui/schema/representation'
import type { LWWRegisterData } from '../crdt/lww-register.js'
import { ORSet, type ORSetData } from '../crdt/or-set.js'
import { PNCounter, type PNCounterData } from '../crdt/pn-counter.js'
import type { CRDTPersistence } from '../persistence/crdt-persistence.js'
import { findAgentMemoryById } from '../utils/sql-helpers.js'

// =============================================================================
// Types
// =============================================================================

export interface EpisodicMemoryData {
  userId: string
  nodeId: string
  memories: ORSetData<string> // Store memory IDs, not full memory objects
  accessCounter: PNCounterData
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
  private memories: ORSet<string> // Stores memory IDs
  private accessCounter: PNCounter
  private userId: string
  private nodeId: string
  private db: Database
  private persistence?: CRDTPersistence
  private memoryCache: Map<string, AgentMemory> = new Map()

  /**
   * Creates a new EpisodicMemory instance.
   *
   * @param userId - User identifier
   * @param nodeId - Node identifier (for CRDT operations)
   * @param db - Database client
   * @param persistence - Optional persistence adapter
   */
  constructor(userId: string, nodeId: string, db: Database, persistence?: CRDTPersistence) {
    this.userId = userId
    this.nodeId = nodeId
    this.db = db
    this.persistence = persistence

    // Initialize CRDTs
    this.memories = new ORSet<string>(nodeId)
    this.accessCounter = new PNCounter(nodeId)
  }

  /**
   * Adds a memory to the collection.
   * Stores the memory in agent_memories table and adds its ID to ORSet.
   *
   * @param memory - Memory to add
   * @returns Tag for this memory addition (for removal)
   */
  async add(memory: AgentMemory): Promise<string> {
    // Validate embedding if provided
    if (memory.embedding) {
      const validationResult = EmbeddingSchema.safeParse(memory.embedding)
      if (!validationResult.success) {
        throw new Error(`Invalid embedding structure: ${validationResult.error.message}`)
      }
    }

    // Store in database
    await this.db.insert(agentMemories).values({
      id: memory.id,
      version: memory.version || 1,
      content: memory.content,
      type: memory.type,
      source: memory.source,
      embedding: memory.embedding?.vector || null,
      embeddingMetadata: memory.embedding || null,
      metadata: memory.metadata,
      accessCount: memory.accessCount || 0,
      accessedAt: memory.accessedAt ? new Date(memory.accessedAt) : new Date(),
      verified: memory.verified || false,
      siteId: memory.metadata?.siteId || null,
      agentId: (memory.metadata?.custom?.agentId as string | undefined) || null,
      createdAt: new Date(memory.createdAt),
      expiresAt: memory.metadata?.expiresAt ? new Date(memory.metadata.expiresAt) : null,
    })

    // Add to ORSet
    const tag = this.memories.add(memory.id)

    // Cache the memory
    this.memoryCache.set(memory.id, memory)

    return tag
  }

  /**
   * Removes a memory by tag.
   *
   * @param tag - Tag returned from add()
   * @returns true if memory was removed
   */
  remove(tag: string): boolean {
    const removed = this.memories.remove(tag)
    if (removed) {
      // Note: We don't delete from database here - that's a design decision
      // The memory stays in DB for audit/history, but is removed from active set
      // If you want to actually delete, call removeById() instead
    }
    return removed
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
    const entries = this.memories.entries()
    let count = 0

    for (const [tag, id] of entries) {
      if (id === memoryId) {
        this.memories.remove(tag)
        count++
      }
    }

    // Delete from database
    if (count > 0) {
      await this.db.delete(agentMemories).where(eq(agentMemories.id, memoryId))
      this.memoryCache.delete(memoryId)
    }

    return count
  }

  /**
   * Gets all memory IDs in the set.
   *
   * @returns Array of memory IDs
   */
  getMemoryIds(): string[] {
    return this.memories.values()
  }

  /**
   * Gets all memories (loads from database if not cached).
   *
   * @returns Array of memory objects
   */
  async getAll(): Promise<AgentMemory[]> {
    const ids = this.memories.values()
    const memories: AgentMemory[] = []

    for (const id of ids) {
      // Check cache first
      if (this.memoryCache.has(id)) {
        memories.push(this.memoryCache.get(id)!)
        continue
      }

      // Load from database (using raw SQL for Neon HTTP compatibility)
      const dbMemory = await findAgentMemoryById(this.db, id)

      if (dbMemory) {
        const memory: AgentMemory = {
          id: dbMemory.id,
          version: dbMemory.version || 1,
          content: dbMemory.content,
          type: dbMemory.type as AgentMemory['type'],
          source: dbMemory.source as AgentMemory['source'],
          embedding: this.extractEmbedding({
            embeddingMetadata: dbMemory.embeddingMetadata,
            embedding: dbMemory.embedding,
          }),
          metadata: (dbMemory.metadata as AgentMemory['metadata']) || { importance: 0.5 },
          createdAt: dbMemory.createdAt.toISOString(),
          accessedAt: dbMemory.accessedAt?.toISOString() || dbMemory.createdAt.toISOString(),
          accessCount: dbMemory.accessCount || 0,
          verified: dbMemory.verified || false,
        }
        this.memoryCache.set(id, memory)
        memories.push(memory)
      }
    }

    return memories
  }

  /**
   * Gets a specific memory by ID.
   *
   * @param memoryId - Memory ID
   * @returns Memory or null if not found
   */
  async get(memoryId: string): Promise<AgentMemory | null> {
    // Check cache
    if (this.memoryCache.has(memoryId)) {
      return this.memoryCache.get(memoryId)!
    }

    // Check if in ORSet
    if (!this.memories.values().includes(memoryId)) {
      return null
    }

    // Load from database (using raw SQL for Neon HTTP compatibility)
    const dbMemory = await findAgentMemoryById(this.db, memoryId)

    if (!dbMemory) {
      return null
    }

    const memory: AgentMemory = {
      id: dbMemory.id,
      version: dbMemory.version || 1,
      content: dbMemory.content,
      type: dbMemory.type as AgentMemory['type'],
      source: dbMemory.source as AgentMemory['source'],
      embedding: this.extractEmbedding({
        embeddingMetadata: dbMemory.embeddingMetadata,
        embedding: dbMemory.embedding,
      }),
      metadata: (dbMemory.metadata as AgentMemory['metadata']) || { importance: 0.5 },
      createdAt: dbMemory.createdAt.toISOString(),
      accessedAt: dbMemory.accessedAt?.toISOString() || dbMemory.createdAt.toISOString(),
      accessCount: dbMemory.accessCount || 0,
      verified: dbMemory.verified || false,
    }

    this.memoryCache.set(memoryId, memory)
    return memory
  }

  /**
   * Increments access counter and updates memory access tracking.
   *
   * @param memoryId - Optional memory ID to track access for
   */
  async incrementAccess(memoryId?: string): Promise<void> {
    this.accessCounter.increment()

    if (memoryId) {
      // Update access count in database (using raw SQL for Neon HTTP compatibility)
      const dbMemory = await findAgentMemoryById(this.db, memoryId)

      if (dbMemory) {
        await this.db
          .update(agentMemories)
          .set({
            accessCount: (dbMemory.accessCount || 0) + 1,
            accessedAt: new Date(),
          })
          .where(eq(agentMemories.id, memoryId))

        // Update cache
        if (this.memoryCache.has(memoryId)) {
          const cached = this.memoryCache.get(memoryId)!
          cached.accessCount = (cached.accessCount || 0) + 1
          cached.accessedAt = new Date().toISOString()
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
    return this.accessCounter.value()
  }

  /**
   * Searches memories (placeholder for vector search integration).
   *
   * @param query - Search query
   * @returns Array of matching memories
   */
  async search(_query: string): Promise<AgentMemory[]> {
    // TODO: Implement vector search using pgvector
    // For now, return all memories
    return this.getAll()
  }

  /**
   * Merges another EpisodicMemory into this one.
   *
   * @param other - EpisodicMemory to merge
   * @returns New merged EpisodicMemory
   */
  merge(other: EpisodicMemory): EpisodicMemory {
    const merged = new EpisodicMemory(this.userId, this.nodeId, this.db, this.persistence)
    merged.memories = this.memories.merge(other.memories)
    merged.accessCounter = this.accessCounter.merge(other.accessCounter)
    return merged
  }

  /**
   * Loads state from database.
   *
   * @throws Error if persistence is not configured
   */
  async load(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not configured. Pass persistence to constructor.')
    }

    const crdtId = `episodic-memory:${this.userId}`
    const states = await this.persistence.loadCompositeState(crdtId)

    // Restore memories ORSet
    const memoriesData = states.get('or_set:memories')
    if (memoriesData && 'added' in memoriesData) {
      this.memories = ORSet.fromData<string>(memoriesData as ORSetData<string>)
    }

    // Restore access counter
    const counterData = states.get('pn_counter:access')
    if (counterData && 'increments' in counterData) {
      this.accessCounter = PNCounter.fromData(counterData as PNCounterData)
    }

    // Preload memory cache
    const ids = this.memories.values()
    for (const id of ids.slice(0, 100)) {
      // Load first 100 into cache
      await this.get(id)
    }
  }

  /**
   * Saves state to database.
   *
   * @throws Error if persistence is not configured
   */
  async save(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not configured. Pass persistence to constructor.')
    }

    const crdtId = `episodic-memory:${this.userId}`
    const states = new Map<string, LWWRegisterData<unknown> | ORSetData<unknown> | PNCounterData>()

    states.set('or_set:memories', this.memories.toData())
    states.set('pn_counter:access', this.accessCounter.toData())

    await this.persistence.saveCompositeState(crdtId, states)
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
    }
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
    const memory = new EpisodicMemory(data.userId, data.nodeId, db, persistence)
    memory.memories = ORSet.fromData<string>(data.memories)
    memory.accessCounter = PNCounter.fromData(data.accessCounter)
    return memory
  }

  /**
   * Creates a copy of this EpisodicMemory.
   *
   * @returns New EpisodicMemory with same state
   */
  clone(): EpisodicMemory {
    return EpisodicMemory.fromData(this.toData(), this.db, this.persistence)
  }

  /**
   * Extracts embedding from database record.
   *
   * Requires embeddingMetadata for all records. Records without embeddingMetadata
   * are considered invalid and will throw an error (data migration required).
   *
   * @param dbMemory - Database memory record
   * @returns Embedding object or undefined
   * @throws Error if embedding exists but embeddingMetadata is missing
   */
  private extractEmbedding(dbMemory: {
    embeddingMetadata: unknown
    embedding: number[] | null
  }): Embedding | undefined {
    // If there's an embedding vector, embeddingMetadata is required
    if (dbMemory.embedding && Array.isArray(dbMemory.embedding) && dbMemory.embedding.length > 0) {
      if (!dbMemory.embeddingMetadata) {
        throw new Error(
          `Memory record has embedding vector but missing embeddingMetadata. ` +
            `Data migration required. All records must have embeddingMetadata. ` +
            `Memory ID: ${(dbMemory as any).id || 'unknown'}`,
        )
      }
    }

    // Extract and validate embeddingMetadata
    if (dbMemory.embeddingMetadata) {
      try {
        const metadata = dbMemory.embeddingMetadata as Embedding
        const validationResult = EmbeddingSchema.safeParse(metadata)
        if (validationResult.success) {
          return validationResult.data
        }
        throw new Error(`Invalid embeddingMetadata structure: ${validationResult.error.message}`)
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid embeddingMetadata')) {
          throw error
        }
        throw new Error(
          `Error parsing embeddingMetadata: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // No embedding at all - return undefined
    return undefined
  }

  /**
   * Gets the user ID.
   */
  getUserId(): string {
    return this.userId
  }

  /**
   * Gets the node ID.
   */
  getNodeId(): string {
    return this.nodeId
  }
}
