/**
 * ElectricSQL Sync Tests
 *
 * Tests for sync shapes and filters.
 */

import { describe, expect, it } from 'vitest'
import {
  createAgentContextsShape,
  createAgentMemoriesShape,
  createConversationsShape,
} from '../sync'

describe('Sync Shapes', () => {
  describe('createAgentContextsShape', () => {
    it('should create shape with agentId', () => {
      const shape = createAgentContextsShape('agent-123')
      expect(shape).toEqual({
        table: 'agent_contexts',
        filter: {
          agent_id: 'agent-123',
        },
      })
    })

    it('should create shape with agentId and sessionId', () => {
      const shape = createAgentContextsShape('agent-123', 'session-456')
      expect(shape).toEqual({
        table: 'agent_contexts',
        filter: {
          agent_id: 'agent-123',
          session_id: 'session-456',
        },
      })
    })
  })

  describe('createAgentMemoriesShape', () => {
    it('should create shape with agentId', () => {
      const shape = createAgentMemoriesShape('agent-123')
      expect(shape).toEqual({
        table: 'agent_memories',
        filter: {
          agent_id: 'agent-123',
        },
      })
    })

    it('should create shape with agentId and siteId', () => {
      const shape = createAgentMemoriesShape('agent-123', 'site-456')
      expect(shape).toEqual({
        table: 'agent_memories',
        filter: {
          agent_id: 'agent-123',
          site_id: 'site-456',
        },
      })
    })
  })

  describe('createConversationsShape', () => {
    it('should create shape with userId', () => {
      const shape = createConversationsShape('user-123')
      expect(shape).toEqual({
        table: 'conversations',
        filter: {
          user_id: 'user-123',
        },
      })
    })

    it('should create shape with userId and agentId', () => {
      const shape = createConversationsShape('user-123', 'agent-456')
      expect(shape).toEqual({
        table: 'conversations',
        filter: {
          user_id: 'user-123',
          agent_id: 'agent-456',
        },
      })
    })
  })
})
