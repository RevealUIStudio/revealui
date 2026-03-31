/**
 * Test Helpers for Pro Memory Integration Tests
 *
 * Utility functions for setting up, running, and cleaning up memory tests.
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import { getVectorClient, resetClient } from '@revealui/db/client';
import { agentMemories } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';

async function generateTestEmbedding(text: string) {
  const embeddingsModule = await import('@revealui/ai/embeddings').catch(() => null);
  if (!embeddingsModule) {
    throw new Error('Memory test helpers require @revealui/ai to be installed');
  }
  return embeddingsModule.generateEmbedding(text);
}

/**
 * Generate a unique test memory ID
 */
export function generateTestMemoryId(prefix = 'test-mem'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique test user ID
 */
export function generateTestUserId(prefix = 'test-user'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a test memory with optional embedding
 */
export async function createTestMemory(overrides: Partial<AgentMemory> = {}): Promise<AgentMemory> {
  const embedding = overrides.embedding || (await generateTestEmbedding('Test memory content'));

  return {
    id: generateTestMemoryId(),
    version: 1,
    content: 'Test memory content',
    type: 'fact',
    source: { type: 'user', id: 'test-user-123', confidence: 1 },
    embedding,
    metadata: { importance: 0.5 },
    createdAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    accessCount: 0,
    verified: false,
    ...overrides,
  };
}

/**
 * Clean up test memories by ID
 */
export async function cleanupTestMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  try {
    resetClient();
    const db = getVectorClient();

    for (const id of ids) {
      try {
        await db.delete(agentMemories).where(eq(agentMemories.id, id));
      } catch (error) {
        // Ignore cleanup errors (memory might not exist)
        console.warn(`Failed to cleanup memory ${id}:`, error);
      }
    }
  } catch (error) {
    console.warn('Error during cleanup:', error);
  }
}

/**
 * Verify a memory exists in the database
 */
export async function verifyMemoryExists(id: string): Promise<boolean> {
  try {
    resetClient();
    const db = getVectorClient();

    const result = await db.query.agentMemories.findFirst({
      where: eq(agentMemories.id, id),
    });

    return result !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get a memory from the database
 */
export async function getMemoryFromDb(id: string): Promise<AgentMemory | null> {
  try {
    resetClient();
    const db = getVectorClient();

    const result = await db.query.agentMemories.findFirst({
      where: eq(agentMemories.id, id),
    });

    if (!result) return null;

    // Convert database format to AgentMemory format
    let embedding: AgentMemory['embedding'];
    if (result.embeddingMetadata) {
      const metadata = result.embeddingMetadata as {
        model: string;
        dimension: number;
        generatedAt: string;
      };
      embedding = {
        vector: Array.isArray(result.embedding) ? result.embedding : [],
        model: metadata.model,
        dimension: metadata.dimension,
        generatedAt: metadata.generatedAt,
      };
    }

    return {
      id: result.id,
      version: result.version,
      content: result.content,
      type: result.type as AgentMemory['type'],
      source: result.source as AgentMemory['source'],
      embedding,
      metadata: (result.metadata as AgentMemory['metadata']) || {},
      accessCount: result.accessCount || 0,
      accessedAt: result.accessedAt?.toISOString() || new Date().toISOString(),
      verified: result.verified,
      createdAt: result.createdAt.toISOString(),
    };
  } catch (error) {
    console.error('Error getting memory from database:', error);
    return null;
  }
}

/**
 * Wait for a condition to be true (with timeout)
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeout = 5000,
  interval = 100,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Test data factory for creating multiple test memories
 */
export class TestMemoryFactory {
  private createdIds: string[] = [];

  async create(overrides: Partial<AgentMemory> = {}): Promise<AgentMemory> {
    const memory = await createTestMemory(overrides);
    this.createdIds.push(memory.id);
    return memory;
  }

  async createBatch(count: number, overrides: Partial<AgentMemory> = {}): Promise<AgentMemory[]> {
    const memories: AgentMemory[] = [];
    for (let i = 0; i < count; i++) {
      const memory = await this.create({
        ...overrides,
        content: `${overrides.content || 'Test memory'} ${i + 1}`,
      });
      memories.push(memory);
    }
    return memories;
  }

  getCreatedIds(): string[] {
    return [...this.createdIds];
  }

  async cleanup(): Promise<void> {
    await cleanupTestMemories(this.createdIds);
    this.createdIds = [];
  }
}
