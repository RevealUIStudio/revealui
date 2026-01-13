import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error - TypeScript can't resolve dynamic route paths with brackets
import {
  DELETE as deleteAgentContext,
  GET as getAgentContext,
  POST as postAgentContext,
} from '../../../app/api/memory/context/[sessionId]/[agentId]/route'
// @ts-expect-error - TypeScript can't resolve dynamic route paths with brackets
import { DELETE as deleteEpisodicMemory } from '../../../app/api/memory/episodic/[userId]/[memoryId]/route'
// @ts-expect-error - TypeScript can't resolve dynamic route paths with brackets
import {
  GET as getEpisodicMemory,
  POST as postEpisodicMemory,
} from '../../../app/api/memory/episodic/[userId]/route'
// Route imports - TypeScript has issues with dynamic route paths containing brackets
// Using @ts-expect-error to suppress the error since the routes do exist at runtime
// @ts-expect-error - TypeScript can't resolve dynamic route paths with brackets
import {
  GET as getWorkingMemory,
  POST as postWorkingMemory,
} from '../../../app/api/memory/working/[sessionId]/route'

// Mock dependencies
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    query: {
      agentContexts: { findFirst: vi.fn() },
      agentMemories: { findFirst: vi.fn(), findMany: vi.fn() },
      nodeIdMappings: { findFirst: vi.fn() },
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn() }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn() }),
  })),
}))

vi.mock('@revealui/ai/memory/persistence', () => ({
  CRDTPersistence: vi.fn().mockImplementation(() => ({
    loadCompositeState: vi.fn().mockResolvedValue(new Map()),
    saveCompositeState: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@revealui/ai/memory/memory', () => ({
  WorkingMemory: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    getSessionId: vi.fn().mockReturnValue('session-123'),
    getContext: vi.fn().mockReturnValue({}),
    getSessionState: vi.fn().mockReturnValue({}),
    getActiveAgents: vi.fn().mockReturnValue([]),
    setContext: vi.fn(),
    updateSessionState: vi.fn(),
    addAgent: vi.fn(),
    removeAgentById: vi.fn(),
  })),
  EpisodicMemory: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    add: vi.fn().mockResolvedValue('tag-123'),
    removeById: vi.fn().mockResolvedValue(1),
    getUserId: vi.fn().mockReturnValue('user-123'),
    getAccessCount: vi.fn().mockReturnValue(0),
  })),
}))

vi.mock('@revealui/ai/memory/agent', () => ({
  AgentContextManager: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    getSessionId: vi.fn().mockReturnValue('session-123'),
    getAgentId: vi.fn().mockReturnValue('agent-456'),
    getAllContext: vi.fn().mockReturnValue({}),
    updateContext: vi.fn(),
    removeContext: vi.fn(),
  })),
}))

vi.mock('@/lib/utils/nodeId', () => ({
  getNodeIdFromSession: vi.fn().mockResolvedValue('node-session-123'),
  getNodeIdFromUser: vi.fn().mockResolvedValue('node-user-123'),
}))

describe('Memory API Routes', () => {
  describe('GET /api/memory/working/:sessionId', () => {
    it('should return working memory for valid sessionId', async () => {
      const request = new NextRequest('http://localhost/api/memory/working/session-123')
      const params = Promise.resolve({ sessionId: 'session-123' })

      const response = await getWorkingMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('sessionId')
      expect(data).toHaveProperty('context')
      expect(data).toHaveProperty('sessionState')
      expect(data).toHaveProperty('activeAgents')
    })

    it('should return 400 for invalid sessionId', async () => {
      const request = new NextRequest('http://localhost/api/memory/working/')
      const params = Promise.resolve({ sessionId: '' })

      const response = await getWorkingMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sessionId')
    })
  })

  describe('POST /api/memory/working/:sessionId', () => {
    it('should update working memory', async () => {
      const request = new NextRequest('http://localhost/api/memory/working/session-123', {
        method: 'POST',
        body: JSON.stringify({
          context: { userId: 'user-1' },
          sessionState: { active: true },
        }),
      })
      const params = Promise.resolve({ sessionId: 'session-123' })

      const response = await postWorkingMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 for invalid sessionId', async () => {
      const request = new NextRequest('http://localhost/api/memory/working/', {
        method: 'POST',
      })
      const params = Promise.resolve({ sessionId: '' })

      const response = await postWorkingMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sessionId')
    })
  })

  describe('GET /api/memory/episodic/:userId', () => {
    it('should return episodic memories for valid userId', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/user-123')
      const params = Promise.resolve({ userId: 'user-123' })

      const response = await getEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('userId')
      expect(data).toHaveProperty('memories')
      expect(data).toHaveProperty('accessCount')
    })

    it('should return 400 for invalid userId', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/')
      const params = Promise.resolve({ userId: '' })

      const response = await getEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid userId')
    })
  })

  describe('POST /api/memory/episodic/:userId', () => {
    it('should add memory with valid embedding', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/user-123', {
        method: 'POST',
        body: JSON.stringify({
          id: 'mem-1',
          content: 'Test memory',
          type: 'fact',
          source: { type: 'user', id: 'user-123', confidence: 1 },
          embedding: {
            model: 'openai-text-embedding-3-small',
            vector: Array(1536).fill(0.1),
            dimension: 1536,
            generatedAt: new Date().toISOString(),
          },
        }),
      })
      const params = Promise.resolve({ userId: 'user-123' })

      const response = await postEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 422 for invalid embedding structure', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/user-123', {
        method: 'POST',
        body: JSON.stringify({
          id: 'mem-1',
          content: 'Test memory',
          type: 'fact',
          source: { type: 'user', id: 'user-123', confidence: 1 },
          embedding: {
            model: 'invalid',
            vector: [1, 2, 3], // Wrong dimension
            dimension: 1536,
            generatedAt: new Date().toISOString(),
          },
        }),
      })
      const params = Promise.resolve({ userId: 'user-123' })

      const response = await postEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error).toContain('embedding')
    })

    it('should return 400 for missing required fields', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/user-123', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test memory',
          // Missing id, type, source
        }),
      })
      const params = Promise.resolve({ userId: 'user-123' })

      const response = await postEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('id, content, type, and source')
    })
  })

  describe('DELETE /api/memory/episodic/:userId/:memoryId', () => {
    it('should delete memory for valid IDs', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/user-123/mem-1', {
        method: 'DELETE',
      })
      const params = Promise.resolve({ userId: 'user-123', memoryId: 'mem-1' })

      const response = await deleteEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 for invalid userId', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic//mem-1', {
        method: 'DELETE',
      })
      const params = Promise.resolve({ userId: '', memoryId: 'mem-1' })

      const response = await deleteEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid userId')
    })

    it('should return 400 for invalid memoryId', async () => {
      const request = new NextRequest('http://localhost/api/memory/episodic/user-123/', {
        method: 'DELETE',
      })
      const params = Promise.resolve({ userId: 'user-123', memoryId: '' })

      const response = await deleteEpisodicMemory(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid memoryId')
    })
  })

  describe('GET /api/memory/context/:sessionId/:agentId', () => {
    it('should return agent context for valid IDs', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456')
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await getAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('sessionId', 'session-123')
      expect(data).toHaveProperty('agentId', 'agent-456')
      expect(data).toHaveProperty('context')
    })

    it('should return 400 for invalid sessionId', async () => {
      const request = new NextRequest('http://localhost/api/memory/context//agent-456')
      const params = Promise.resolve({ sessionId: '', agentId: 'agent-456' })

      const response = await getAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sessionId')
    })

    it('should return 400 for invalid agentId', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/')
      const params = Promise.resolve({ sessionId: 'session-123', agentId: '' })

      const response = await getAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid agentId')
    })
  })

  describe('POST /api/memory/context/:sessionId/:agentId', () => {
    it('should update agent context with single key-value', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark' }),
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await postAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sessionId).toBe('session-123')
      expect(data.agentId).toBe('agent-456')
    })

    it('should update agent context with multiple keys', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark', language: 'en' }),
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await postAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: 'invalid json{',
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await postAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid JSON')
    })

    it('should return 400 for non-object body', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'POST',
        body: JSON.stringify('not an object'),
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await postAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('must be a JSON object')
    })

    it('should return 400 for invalid sessionId', async () => {
      const request = new NextRequest('http://localhost/api/memory/context//agent-456', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark' }),
      })
      const params = Promise.resolve({ sessionId: '', agentId: 'agent-456' })

      const response = await postAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sessionId')
    })

    it('should return 400 for invalid agentId', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/', {
        method: 'POST',
        body: JSON.stringify({ theme: 'dark' }),
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: '' })

      const response = await postAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid agentId')
    })
  })

  describe('DELETE /api/memory/context/:sessionId/:agentId', () => {
    it('should remove context key', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'DELETE',
        body: JSON.stringify({ key: 'theme' }),
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await deleteAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 for missing key', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'DELETE',
        body: JSON.stringify({}),
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await deleteAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing or invalid key')
    })

    it('should handle missing body gracefully', async () => {
      const request = new NextRequest('http://localhost/api/memory/context/session-123/agent-456', {
        method: 'DELETE',
      })
      const params = Promise.resolve({ sessionId: 'session-123', agentId: 'agent-456' })

      const response = await deleteAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing or invalid key')
    })

    it('should return 400 for invalid sessionId', async () => {
      const request = new NextRequest('http://localhost/api/memory/context//agent-456', {
        method: 'DELETE',
        body: JSON.stringify({ key: 'theme' }),
      })
      const params = Promise.resolve({ sessionId: '', agentId: 'agent-456' })

      const response = await deleteAgentContext(request, { params })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sessionId')
    })
  })
})
