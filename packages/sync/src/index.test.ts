/**
 * Tests for @revealui/sync package
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSyncClient } from './client/index.js'
import { MemoryServiceImpl } from './memory/index.js'
import { CollaborationServiceImpl } from './collaboration/index.js'
import { createAgentMemoriesShape, createConversationsShape } from './shapes.js'

describe('@revealui/sync', () => {
  describe('createSyncClient', () => {
    it('should create sync client with correct config', () => {
      const config = {
        databaseType: 'rest' as const,
        debug: true,
      }

      const client = createSyncClient(config)
      expect(client).toBeDefined()
      expect(typeof client.connect).toBe('function')
      expect(typeof client.disconnect).toBe('function')
      expect(client.isConnected()).toBe(false)
      expect(client.memory).toBeDefined()
      expect(client.collaboration).toBeDefined()
    })

    it('should create client with default values', () => {
      const client = createSyncClient()

      expect(client).toBeDefined()
      expect(client.isConnected()).toBe(false)
    })
  })

  describe('Shape Creation', () => {
    it('should create agent memories shape', () => {
      const shape = createAgentMemoriesShape({
        userId: 'user-1',
        agentId: 'agent-1',
      })

      expect(shape).toEqual({
        table: 'agent_memories',
        where:
          "expires_at IS NULL OR expires_at > NOW() AND agent_id = 'user-1' AND agent_id = 'agent-1'",
      })
    })

    it('should create conversations shape', () => {
      const shape = createConversationsShape({
        userId: 'user-1',
      })

      expect(shape).toEqual({
        table: 'conversations',
        where: "user_id = 'user-1'",
      })
    })
  })

  describe('MemoryServiceImpl', () => {
    let service: MemoryServiceImpl
    let mockClient: any

    beforeEach(() => {
      mockClient = {}
      service = new MemoryServiceImpl(() => mockClient)
    })

    it('should store memory', async () => {
      const memory = {
        userId: 'user-1',
        agentId: 'agent-1',
        content: 'test memory',
        context: { key: 'value' },
        importance: 0.8,
        type: 'fact' as const,
        metadata: {},
      }

      const result = await service.store(memory)
      expect(result).toBeDefined()
      expect(result.content).toBe('test memory')
      expect(result.userId).toBe('user-1')
    })

    it('should retrieve memories', async () => {
      const memories = await service.retrieve('user-1')
      expect(Array.isArray(memories)).toBe(true)
    })

    it('should delete memory', async () => {
      const result = await service.delete('memory-1')
      expect(result).toBe(true)
    })

    it('should get memory stats', async () => {
      const stats = await service.getStats('user-1')
      expect(stats).toBeDefined()
      expect(typeof stats.totalMemories).toBe('number')
    })

    it('should find similar memories', async () => {
      const results = await service.findSimilar('user-1', 'test query')
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('CollaborationServiceImpl', () => {
    let service: CollaborationServiceImpl
    let mockClient: any

    beforeEach(() => {
      mockClient = {}
      service = new CollaborationServiceImpl(() => mockClient)
    })

    it('should create conversation', async () => {
      const conversation = await service.createConversation({
        userId: 'user-1',
        agentId: 'agent-1',
        title: 'Test Chat',
      })

      expect(conversation).toBeDefined()
      expect(conversation.userId).toBe('user-1')
      expect(conversation.title).toBe('Test Chat')
    })

    it('should get conversations', async () => {
      const conversations = await service.getConversations('user-1')
      expect(Array.isArray(conversations)).toBe(true)
    })

    it('should send message', async () => {
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: new Date(),
      }

      await service.sendMessage('conv-1', message, 'user-1')
      // Should not throw
    })

    it('should get conversation history', async () => {
      const messages = await service.getConversationHistory('conv-1')
      expect(Array.isArray(messages)).toBe(true)
    })

    it('should create session', async () => {
      const session = await service.createSession('doc-1', ['user-1', 'user-2'])
      expect(session).toBeDefined()
      expect(session.documentId).toBe('doc-1')
      expect(session.participants).toEqual(['user-1', 'user-2'])
    })

    it('should get active sessions', async () => {
      const sessions = await service.getActiveSessions('doc-1')
      expect(Array.isArray(sessions)).toBe(true)
    })
  })
})
