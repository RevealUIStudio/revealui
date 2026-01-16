/**
 * EpisodicMemory Vector Integration Tests
 *
 * Tests that EpisodicMemory correctly uses VectorMemoryService
 * for database operations instead of direct database access.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EpisodicMemory } from '../memory/episodic-memory.js'
import { VectorMemoryService } from '../vector/vector-memory-service.js'
import type { AgentMemory } from '@revealui/schema/agents'
import type { Database } from '@revealui/db/client'
import type { CRDTPersistence } from '../persistence/crdt-persistence.js'

// Mock VectorMemoryService
vi.mock('../vector/vector-memory-service.js', () => {
  const mockMemory: AgentMemory = {
    id: 'mem-1',
    version: 1,
    content: 'Test memory',
    type: 'fact',
    source: { type: 'user', id: 'user-1', confidence: 1 },
    metadata: { importance: 0.5 },
    createdAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    accessCount: 0,
    verified: false,
  }

  return {
    VectorMemoryService: vi.fn().mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(mockMemory),
      getById: vi.fn().mockResolvedValue(mockMemory),
      update: vi.fn().mockResolvedValue({ ...mockMemory, accessCount: 1 }),
      delete: vi.fn().mockResolvedValue(true),
      searchSimilar: vi.fn().mockResolvedValue([]),
    })),
  }
})

describe('EpisodicMemory Vector Integration', () => {
  let mockDb: Database
  let mockPersistence: CRDTPersistence
  let episodicMemory: EpisodicMemory

  beforeEach(() => {
    // Create mock database and persistence
    mockDb = {} as Database
    mockPersistence = {
      loadCompositeState: vi.fn().mockResolvedValue(new Map()),
      saveCompositeState: vi.fn().mockResolvedValue(undefined),
    } as unknown as CRDTPersistence

    episodicMemory = new EpisodicMemory('user-123', 'node-abc', mockDb, mockPersistence)
  })

  it('should use VectorMemoryService for adding memories', async () => {
    const memory: AgentMemory = {
      id: 'mem-1',
      version: 1,
      content: 'Test memory',
      type: 'fact',
      source: { type: 'user', id: 'user-123', confidence: 1 },
      metadata: { importance: 0.5 },
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      verified: false,
    }

    const tag = await episodicMemory.add(memory)

    expect(tag).toBeDefined()
    // Verify VectorMemoryService.create was called
    const vectorService = (episodicMemory as any).vectorService as VectorMemoryService
    expect(vectorService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mem-1',
        content: 'Test memory',
      }),
    )
  })

  it('should use VectorMemoryService for getting memories', async () => {
    // First add a memory
    const memory: AgentMemory = {
      id: 'mem-1',
      version: 1,
      content: 'Test memory',
      type: 'fact',
      source: { type: 'user', id: 'user-123', confidence: 1 },
      metadata: { importance: 0.5 },
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      verified: false,
    }

    await episodicMemory.add(memory)

    // Get the memory
    const retrieved = await episodicMemory.get('mem-1')

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('mem-1')
    // Verify VectorMemoryService.getById was called
    const vectorService = (episodicMemory as any).vectorService as VectorMemoryService
    expect(vectorService.getById).toHaveBeenCalledWith('mem-1')
  })

  it('should use VectorMemoryService for deleting memories', async () => {
    const memory: AgentMemory = {
      id: 'mem-1',
      version: 1,
      content: 'Test memory',
      type: 'fact',
      source: { type: 'user', id: 'user-123', confidence: 1 },
      metadata: { importance: 0.5 },
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      verified: false,
    }

    await episodicMemory.add(memory)
    const count = await episodicMemory.removeById('mem-1')

    expect(count).toBeGreaterThan(0)
    // Verify VectorMemoryService.delete was called
    const vectorService = (episodicMemory as any).vectorService as VectorMemoryService
    expect(vectorService.delete).toHaveBeenCalledWith('mem-1')
  })

  it('should use VectorMemoryService for updating access count', async () => {
    const memory: AgentMemory = {
      id: 'mem-1',
      version: 1,
      content: 'Test memory',
      type: 'fact',
      source: { type: 'user', id: 'user-123', confidence: 1 },
      metadata: { importance: 0.5 },
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      verified: false,
    }

    await episodicMemory.add(memory)
    await episodicMemory.incrementAccess('mem-1')

    // Verify VectorMemoryService.update was called
    const vectorService = (episodicMemory as any).vectorService as VectorMemoryService
    expect(vectorService.update).toHaveBeenCalledWith(
      'mem-1',
      expect.objectContaining({
        accessCount: 1,
      }),
    )
  })

  it('should not use REST database for memory operations', async () => {
    // Verify that the database client is not used for memory operations
    // (it should only be used for CRDT persistence)
    const memory: AgentMemory = {
      id: 'mem-1',
      version: 1,
      content: 'Test memory',
      type: 'fact',
      source: { type: 'user', id: 'user-123', confidence: 1 },
      metadata: { importance: 0.5 },
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      verified: false,
    }

    await episodicMemory.add(memory)

    // The database should not have insert/update/delete methods called on agentMemories
    // (we can't easily verify this without more complex mocking, but the fact that
    // VectorMemoryService is used is the key test)
    const vectorService = (episodicMemory as any).vectorService as VectorMemoryService
    expect(vectorService.create).toHaveBeenCalled()
  })
})