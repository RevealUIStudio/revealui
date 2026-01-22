/**
 * Sync Package Integration Tests
 *
 * Tests for sync package localStorage operations.
 * Verifies that conversations and memories persist correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createSyncClient } from '../client/index.js'
import type { SyncClient } from '../client/index.js'

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

// Setup global mocks
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('Sync Package Integration', () => {
  let client: SyncClient

  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()

    // Create client
    client = createSyncClient({
      databaseType: 'rest',
      debug: false,
    })
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('Conversation Operations', () => {
    it('should create conversations with localStorage persistence', async () => {
      const conversation = await client.collaboration.createConversation({
        userId: 'user-1',
        agentId: 'agent-1',
        title: 'Test Conversation',
      })

      expect(conversation).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          agentId: 'agent-1',
          title: 'Test Conversation',
          messages: [],
        })
      )
      expect(conversation.id).toBeDefined()
      expect(conversation.createdAt).toBeInstanceOf(Date)
    })

    it('should retrieve conversations from localStorage', async () => {
      // Create a conversation
      await client.collaboration.createConversation({
        userId: 'user-1',
        agentId: 'agent-1',
        title: 'Test Conversation',
      })

      // Retrieve conversations
      const conversations = await client.collaboration.getConversations('user-1')

      expect(conversations).toHaveLength(1)
      expect(conversations[0]).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          agentId: 'agent-1',
          title: 'Test Conversation',
          messages: [],
        })
      )
    })

    it('should persist conversations across client instances', async () => {
      // Create conversation with first client
      await client.collaboration.createConversation({
        userId: 'user-1',
        agentId: 'agent-1',
        title: 'Persistent Conversation',
      })

      // Create new client instance (simulating page refresh)
      const newClient = createSyncClient({ databaseType: 'rest' })
      const conversations = await newClient.collaboration.getConversations('user-1')

      expect(conversations).toHaveLength(1)
      expect(conversations[0].title).toBe('Persistent Conversation')
    })

    it('should send messages to conversations', async () => {
      const conversation = await client.collaboration.createConversation({
        userId: 'user-1',
        agentId: 'agent-1',
        title: 'Message Test',
      })

      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello, AI!',
        timestamp: new Date(),
      }

      await client.collaboration.sendMessage(conversation.id, message, 'user-1')

      // Verify message was added
      const conversations = await client.collaboration.getConversations('user-1')
      expect(conversations[0].messages).toHaveLength(1)
      expect(conversations[0].messages[0]).toEqual(message)
    })

    it('should get conversation history', async () => {
      const conversation = await client.collaboration.createConversation({
        userId: 'user-1',
        agentId: 'agent-1',
        title: 'History Test',
      })

      const messages = [
        { id: 'msg-1', role: 'user' as const, content: 'Hello', timestamp: new Date() },
        { id: 'msg-2', role: 'assistant' as const, content: 'Hi there!', timestamp: new Date() },
      ]

      for (const message of messages) {
        await client.collaboration.sendMessage(conversation.id, message, 'user-1')
      }

      const history = await client.collaboration.getConversationHistory(conversation.id)
      expect(history).toHaveLength(2)
      expect(history).toEqual(messages)
    })
  })

  describe('Memory Operations', () => {
    it('should store memories with localStorage persistence', async () => {
      const memory = await client.memory.store({
        content: 'Test memory content',
        type: 'fact' as const,
        source: { type: 'user_input', sessionId: 'session-1' },
        metadata: { importance: 0.8 },
      })

      expect(memory).toEqual(
        expect.objectContaining({
          content: 'Test memory content',
          type: 'fact',
          metadata: { importance: 0.8 },
        })
      )
      expect(memory.id).toBeDefined()
      expect(memory.createdAt).toBeInstanceOf(Date)
    })

    it('should retrieve memories from localStorage', async () => {
      await client.memory.store({
        content: 'Test memory',
        type: 'fact' as const,
        source: { type: 'user_input' },
      })

      const memories = await client.memory.retrieve('user-1')

      expect(memories).toHaveLength(1)
      expect(memories[0]).toEqual(
        expect.objectContaining({
          content: 'Test memory',
          type: 'fact',
        })
      )
    })

    it('should persist memories across client instances', async () => {
      await client.memory.store({
        content: 'Persistent memory',
        type: 'skill' as const,
        source: { type: 'learned' },
      })

      // Create new client instance
      const newClient = createSyncClient({ databaseType: 'rest' })
      const memories = await newClient.memory.retrieve('user-1')

      expect(memories).toHaveLength(1)
      expect(memories[0].content).toBe('Persistent memory')
    })

    it('should get memory statistics', async () => {
      await client.memory.store({
        content: 'Memory 1',
        type: 'fact' as const,
        source: { type: 'user_input' },
      })

      await client.memory.store({
        content: 'Memory 2',
        type: 'skill' as const,
        source: { type: 'learned' },
      })

      const stats = await client.memory.getStats('user-1')

      expect(stats.totalMemories).toBe(2)
      expect(stats.memoryCount).toBe(2)
      expect(stats.typeBreakdown).toEqual({
        fact: 1,
        skill: 1,
      })
    })

    it('should find similar memories with text search', async () => {
      await client.memory.store({
        content: 'JavaScript is a programming language',
        type: 'fact' as const,
        source: { type: 'documentation' },
      })

      await client.memory.store({
        content: 'Python is also a programming language',
        type: 'fact' as const,
        source: { type: 'documentation' },
      })

      await client.memory.store({
        content: 'Cooking recipes are important',
        type: 'fact' as const,
        source: { type: 'book' },
      })

      const similar = await client.memory.findSimilar('user-1', 'programming')

      expect(similar).toHaveLength(2)
      expect(similar.every(m => m.content.includes('programming'))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle conversation not found errors', async () => {
      await expect(
        client.collaboration.getConversationHistory('non-existent-id')
      ).rejects.toThrow('Conversation not found')
    })

    it('should handle invalid conversation operations', async () => {
      await expect(
        client.collaboration.sendMessage('invalid-id', {
          id: 'msg-1',
          role: 'user',
          content: 'test',
          timestamp: new Date(),
        }, 'user-1')
      ).rejects.toThrow('Conversation not found')
    })
  })
})