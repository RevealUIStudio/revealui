/**
 * Memory Service
 *
 * Persistent memory service using localStorage for immediate functionality.
 * Foundation for database integration with vector search and ElectricSQL sync.
 */

import type { SyncClient } from '../client/index.js'
import { MemoryItem } from '../index.js'


// localStorage-backed memory storage
interface StoredMemory extends MemoryItem {
  updatedAt?: Date
  type?: string
  metadata?: Record<string, unknown>
}

export interface MemoryService {
  /** Store new memory item */
  store(memory: Omit<StoredMemory, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredMemory>
  /** Retrieve memories with optional filtering */
  retrieve(userId: string, context?: any, limit?: number): Promise<StoredMemory[]>
  /** Update existing memory */
  update(id: string, updates: Partial<Pick<StoredMemory, 'content' | 'importance' | 'metadata'>>): Promise<StoredMemory | null>
  /** Delete memory by ID */
  delete(id: string): Promise<boolean>
  /** Get memory statistics */
  getStats(userId: string): Promise<MemoryStats>
  /** Find similar memories (semantic search) */
  findSimilar(userId: string, query: string, limit?: number): Promise<StoredMemory[]>
}

export interface MemoryStats {
  totalMemories: number
  averageImportance: number
  memoryCount: number
  recentCount: number
  typeBreakdown: Record<string, number>
}

/**
 * MemoryService implementation using PostgreSQL database.
 * Provides persistent memory storage with foundation for ElectricSQL real-time sync.
 */
export class MemoryServiceImpl implements MemoryService {
  constructor(private getClient: () => SyncClient) {}

  private get client(): SyncClient {
    return this.getClient()
  }

  async store(memory: Omit<StoredMemory, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredMemory> {
    const id = crypto.randomUUID()
    const now = new Date()

    // Insert into database
    await this.client.db.insert(agentMemories).values({
      id,
      content: memory.content,
      type: memory.type,
      source: memory.source,
      embedding: memory.embedding,
      embeddingMetadata: memory.embeddingMetadata,
      metadata: memory.metadata || {},
      siteId: memory.siteId,
      agentId: memory.agentId,
    })

    const newMemory: StoredMemory = {
      ...memory,
      id,
      createdAt: now,
    }

    return newMemory
  }

  async retrieve(_userId: string, context?: any, limit = 50): Promise<StoredMemory[]> {
    // Build where conditions
    let whereConditions = sql`true` // Start with always true

    if (context?.type) {
      whereConditions = and(whereConditions, eq(agentMemories.type, context.type))
    }
    if (context?.agentId) {
      whereConditions = and(whereConditions, eq(agentMemories.agentId, context.agentId))
    }

    // Query database
    const dbMemories = await this.client.db
      .select()
      .from(agentMemories)
      .where(whereConditions)
      .orderBy(desc(agentMemories.createdAt))
      .limit(limit)

    // Convert to StoredMemory format and filter expired
    return dbMemories
      .filter(memory => !memory.expiresAt || memory.expiresAt > new Date())
      .map(dbMemory => ({
        id: dbMemory.id,
        content: dbMemory.content,
        type: dbMemory.type as MemoryType,
      source: dbMemory.source as any,
        embedding: dbMemory.embedding as number[],
      embeddingMetadata: dbMemory.embeddingMetadata as any,
      metadata: dbMemory.metadata as any,
        accessCount: dbMemory.accessCount,
        accessedAt: dbMemory.accessedAt,
        verified: dbMemory.verified,
        verifiedBy: dbMemory.verifiedBy,
        verifiedAt: dbMemory.verifiedAt,
        siteId: dbMemory.siteId,
        agentId: dbMemory.agentId,
        createdAt: dbMemory.createdAt,
        expiresAt: dbMemory.expiresAt,
      }))
  }

  async update(id: string, updates: Partial<Pick<StoredMemory, 'content' | 'importance' | 'metadata'>>): Promise<StoredMemory | null> {
    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata
    // Note: importance might map to metadata or a separate field

    // Update database
    const result = await this.client.db
      .update(agentMemories)
      .set(updateData)
      .where(eq(agentMemories.id, id))
      .returning()

    if (result.length === 0) return null

    const dbMemory = result[0]
    return {
      id: dbMemory.id,
      content: dbMemory.content,
      type: dbMemory.type as MemoryType,
      source: dbMemory.source as any,
      embedding: dbMemory.embedding as number[],
      embeddingMetadata: dbMemory.embeddingMetadata as any,
      metadata: dbMemory.metadata as any,
      accessCount: dbMemory.accessCount,
      accessedAt: dbMemory.accessedAt,
      verified: dbMemory.verified,
      verifiedBy: dbMemory.verifiedBy,
      verifiedAt: dbMemory.verifiedAt,
      siteId: dbMemory.siteId,
      agentId: dbMemory.agentId,
      createdAt: dbMemory.createdAt,
      expiresAt: dbMemory.expiresAt,
    }
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.db
      .delete(agentMemories)
      .where(eq(agentMemories.id, id))

    return result.rowCount > 0
  }

  async getStats(_userId: string): Promise<MemoryStats> {
    // Get all memories from database
    const allMemories = await this.client.db
      .select()
      .from(agentMemories)

    // Filter expired memories
    const validMemories = allMemories.filter(memory => !memory.expiresAt || memory.expiresAt > new Date())

    const totalMemories = validMemories.length

    // Calculate average importance (assuming importance is stored in metadata)
    const memoriesWithImportance = validMemories.filter(m =>
      m.metadata && typeof m.metadata === 'object' && 'importance' in (m.metadata as any)
    )
    const averageImportance = memoriesWithImportance.length > 0
      ? memoriesWithImportance.reduce((sum, memory) =>
          sum + ((memory.metadata as any)?.importance || 0), 0
        ) / memoriesWithImportance.length
      : 0

    const recentCount = validMemories.filter(memory => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return memory.createdAt > oneDayAgo
    }).length

    // Type breakdown
    const typeBreakdown = validMemories.reduce((acc, memory) => {
      const type = memory.type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalMemories,
      averageImportance,
      memoryCount: totalMemories,
      recentCount,
      typeBreakdown,
    }
  }

  async findSimilar(_userId: string, query: string, limit = 10): Promise<StoredMemory[]> {
    // Simple text-based search for now
    // TODO: Implement vector similarity search using embeddings when ElectricSQL is available

    const dbMemories = await this.client.db
      .select()
      .from(agentMemories)
      .where(sql`${agentMemories.content} ILIKE ${`%${query}%`}`)
      .orderBy(desc(agentMemories.createdAt)) // Simple relevance by recency
      .limit(limit)

    return dbMemories.map(dbMemory => ({
      id: dbMemory.id,
      content: dbMemory.content,
      type: dbMemory.type as MemoryType,
      source: dbMemory.source as any,
      embedding: dbMemory.embedding as number[],
      embeddingMetadata: dbMemory.embeddingMetadata as any,
      metadata: dbMemory.metadata as any,
      accessCount: dbMemory.accessCount,
      accessedAt: dbMemory.accessedAt,
      verified: dbMemory.verified,
      verifiedBy: dbMemory.verifiedBy,
      verifiedAt: dbMemory.verifiedAt,
      siteId: dbMemory.siteId,
      agentId: dbMemory.agentId,
      createdAt: dbMemory.createdAt,
      expiresAt: dbMemory.expiresAt,
    }))
  }
}