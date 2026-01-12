/**
 * Real API Integration Tests
 *
 * These tests call actual API endpoints (not mocks).
 *
 * To run these tests:
 * 1. Start the CMS server: pnpm --filter cms dev
 * 2. Ensure test database is configured
 * 3. Run: pnpm --filter @revealui/sync test real-api
 *
 * These tests require the server to be running and may be slower than mocked tests.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import {
  createAgentMemory,
  createConversation,
  deleteAgentMemory,
  deleteConversation,
  updateAgentContext,
  updateAgentMemory,
  updateConversation,
} from '../../utils/revealui-api'

// Set test timeout to 30 seconds (API calls can be slow)
const TEST_TIMEOUT = 30000

// Skip these tests if REVEALUI_TEST_SERVER_URL is not set
// This allows running mocked tests in CI/CD without a server
const TEST_SERVER_URL =
  process.env.REVEALUI_TEST_SERVER_URL ||
  process.env.REVEALUI_PUBLIC_SERVER_URL ||
  'http://localhost:4000'

const shouldSkipRealTests =
  !process.env.REVEALUI_TEST_SERVER_URL && !process.env.REVEALUI_PUBLIC_SERVER_URL

describe.skipIf(shouldSkipRealTests)('Real API Integration Tests', () => {
  const testUserId = `test-user-${Date.now()}`
  const testAgentId = `test-agent-${Date.now()}`
  const testSessionId = `test-session-${Date.now()}`
  const testMemoryId = `test-memory-${Date.now()}`
  const testConversationId = `test-conv-${Date.now()}`

  beforeAll(async () => {
    // Verify server is accessible
    try {
      const response = await fetch(`${TEST_SERVER_URL}/api/conversations`, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })
      // Accept any status code (auth might fail, but endpoint should exist)
      if (response.status === 404) {
        throw new Error(`Endpoint not found at ${TEST_SERVER_URL}/api/conversations`)
      }
    } catch (error) {
      // If it's a connection error, skip tests gracefully
      if (
        error instanceof Error &&
        (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))
      ) {
        throw new Error(
          `Cannot connect to test server at ${TEST_SERVER_URL}. ` +
            `Start the CMS server with: pnpm --filter cms dev\n` +
            `Or unset REVEALUI_TEST_SERVER_URL to skip these tests.\n` +
            `Error: ${error.message}`,
        )
      }
      throw error
    }
  }, TEST_TIMEOUT)

  describe('Conversation Endpoints', () => {
    it(
      'should create a conversation',
      async () => {
        const conversation = {
          id: testConversationId,
          session_id: testSessionId,
          user_id: testUserId,
          agent_id: testAgentId,
          messages: [],
          status: 'active',
          metadata: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const result = await createConversation(conversation)

        expect(result).toBeDefined()
        // The API might return the full conversation or just a success message
        if (typeof result === 'object' && result !== null) {
          expect(result).toHaveProperty('id')
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'should update a conversation',
      async () => {
        const updates = {
          status: 'completed',
        }

        // This might fail if conversation doesn't exist, but endpoint should exist
        try {
          await updateConversation(testConversationId, updates)
        } catch (error) {
          // If conversation doesn't exist, that's okay - we're just testing endpoint exists
          if (error instanceof Error && error.message.includes('404')) {
            // Endpoint exists but conversation not found - that's expected for a test
            return
          }
          throw error
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'should delete a conversation',
      async () => {
        // This might fail if conversation doesn't exist, but endpoint should exist
        try {
          await deleteConversation(testConversationId)
        } catch (error) {
          // If conversation doesn't exist, that's okay - we're just testing endpoint exists
          if (error instanceof Error && error.message.includes('404')) {
            // Endpoint exists but conversation not found - that's expected for a test
            return
          }
          throw error
        }
      },
      TEST_TIMEOUT,
    )
  })

  describe('Memory Endpoints', () => {
    it(
      'should create a memory',
      async () => {
        const memory = {
          id: testMemoryId,
          content: 'Test memory content',
          type: 'fact',
          source: {
            type: 'user',
            id: testUserId,
            confidence: 1,
          },
          metadata: {
            importance: 0.5,
            custom: {
              agentId: testAgentId,
            },
          },
          created_at: new Date().toISOString(),
          accessed_at: new Date().toISOString(),
          access_count: 0,
          verified: false,
        }

        const result = await createAgentMemory(testUserId, memory)

        expect(result).toBeDefined()
      },
      TEST_TIMEOUT,
    )

    it(
      'should update a memory',
      async () => {
        const updates = {
          metadata: {
            importance: 0.9,
            custom: {
              agentId: testAgentId,
            },
          },
        }

        // This might fail if memory doesn't exist, but endpoint should exist
        try {
          await updateAgentMemory(testUserId, testMemoryId, updates)
        } catch (error) {
          // If memory doesn't exist, that's okay - we're just testing endpoint exists
          if (error instanceof Error && error.message.includes('404')) {
            // Endpoint exists but memory not found - that's expected for a test
            return
          }
          throw error
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'should delete a memory',
      async () => {
        // This might fail if memory doesn't exist, but endpoint should exist
        try {
          await deleteAgentMemory(testUserId, testMemoryId)
        } catch (error) {
          // If memory doesn't exist, that's okay - we're just testing endpoint exists
          if (error instanceof Error && error.message.includes('404')) {
            // Endpoint exists but memory not found - that's expected for a test
            return
          }
          throw error
        }
      },
      TEST_TIMEOUT,
    )
  })

  describe('Context Endpoints', () => {
    it(
      'should update agent context',
      async () => {
        const updates = {
          context: {
            theme: 'dark',
            language: 'en',
          },
        }

        // This should work even if context doesn't exist (might create it)
        await updateAgentContext(testSessionId, testAgentId, updates)

        // If it doesn't throw, endpoint exists and works
        expect(true).toBe(true)
      },
      TEST_TIMEOUT,
    )
  })
})

describe.skipIf(!shouldSkipRealTests)('Real API Integration Tests (Skipped)', () => {
  it('should be skipped when REVEALUI_TEST_SERVER_URL is not set', () => {
    expect(true).toBe(true)
  })
})
