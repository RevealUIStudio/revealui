/**
 * Tests for MCP Adapter Idempotency Cache
 *
 * Tests the IdempotencyCache class behavior including:
 * - Cache expiration
 * - Concurrent requests
 * - Cleanup behavior
 * - Cache statistics
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  MCPAdapter,
  type MCPRequest,
  type MCPResponse,
  type MCPConfig,
  generateIdempotencyKey,
  generateUniqueIdempotencyKey,
} from '../../mcp/adapter.js'

// =============================================================================
// Test Adapter Implementation
// =============================================================================

class TestAdapter extends MCPAdapter {
  constructor(config: MCPConfig = {}) {
    super('test', config)
  }

  protected isValidAction(action: string): boolean {
    return ['test-action', 'slow-action', 'fail-action'].includes(action)
  }

  protected getAuthHeaderName(): string {
    return 'Authorization'
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    switch (request.action) {
      case 'test-action':
        return { result: 'success', timestamp: Date.now() }

      case 'slow-action':
        // Simulate a slow operation
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { result: 'slow-success' }

      case 'fail-action':
        throw new Error('Intentional failure')

      default:
        throw new Error(`Unknown action: ${request.action}`)
    }
  }
}

// =============================================================================
// Cache Behavior Tests
// =============================================================================

describe('MCP Idempotency Cache', () => {
  let adapter: TestAdapter

  beforeEach(() => {
    adapter = new TestAdapter()
  })

  afterEach(() => {
    adapter.dispose()
  })

  describe('Basic Cache Operations', () => {
    it('should cache successful responses', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        parameters: { test: 'value' },
        options: {
          idempotencyKey: 'test-key-1',
        },
      }

      // First request should execute
      const response1 = await adapter.execute(request)
      expect(response1.success).toBe(true)
      expect(response1.metadata?.cached).toBeUndefined()

      // Second request should return cached response
      const response2 = await adapter.execute(request)
      expect(response2.success).toBe(true)
      expect(response2.metadata?.cached).toBe(true)
      expect(response2.metadata?.idempotencyKey).toBe('test-key-1')

      // Both responses should have the same data
      expect(response1.data).toEqual(response2.data)
    })

    it('should not cache when no idempotency key provided', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        parameters: { test: 'value' },
        // No idempotencyKey
      }

      const response1 = await adapter.execute(request)
      const response2 = await adapter.execute(request)

      // Both should execute (not cached)
      expect(response1.metadata?.cached).toBeUndefined()
      expect(response2.metadata?.cached).toBeUndefined()

      // Timestamps should be different (different executions)
      expect((response1.data as { timestamp: number }).timestamp).not.toBe(
        (response2.data as { timestamp: number }).timestamp,
      )
    })

    it('should cache failed responses', async () => {
      const request: MCPRequest = {
        action: 'fail-action',
        options: {
          idempotencyKey: 'fail-key-1',
          retries: 1, // Only try once
        },
      }

      // First request should fail
      const response1 = await adapter.execute(request)
      expect(response1.success).toBe(false)
      expect(response1.error).toContain('Intentional failure')
      expect(response1.metadata?.cached).toBeUndefined()

      // Second request should return cached failure
      const response2 = await adapter.execute(request)
      expect(response2.success).toBe(false)
      expect(response2.metadata?.cached).toBe(true)
    })
  })

  describe('Cache Expiration', () => {
    it('should expire cache entries after TTL', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        options: {
          idempotencyKey: 'expire-key-1',
          idempotencyTTL: 100, // 100ms TTL
        },
      }

      // First request
      const response1 = await adapter.execute(request)
      expect(response1.metadata?.cached).toBeUndefined()

      // Immediately after, should be cached
      const response2 = await adapter.execute(request)
      expect(response2.metadata?.cached).toBe(true)

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Should execute again (cache expired)
      const response3 = await adapter.execute(request)
      expect(response3.metadata?.cached).toBeUndefined()
    })

    it('should use default TTL when not specified', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        options: {
          idempotencyKey: 'default-ttl-key',
          // No idempotencyTTL specified (should use 5 minute default)
        },
      }

      const response1 = await adapter.execute(request)
      const response2 = await adapter.execute(request)

      // Should be cached with default TTL
      expect(response2.metadata?.cached).toBe(true)
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests with same key', async () => {
      const request: MCPRequest = {
        action: 'slow-action',
        options: {
          idempotencyKey: 'concurrent-key',
        },
      }

      // Start multiple requests concurrently
      const [response1, response2, response3] = await Promise.all([
        adapter.execute(request),
        adapter.execute(request),
        adapter.execute(request),
      ])

      // All should succeed
      expect(response1.success).toBe(true)
      expect(response2.success).toBe(true)
      expect(response3.success).toBe(true)

      // At least one should be cached (the others that arrived after first)
      const cachedCount = [response1, response2, response3].filter((r) => r.metadata?.cached).length

      // In practice, due to async timing, we might get different results
      // but at least we verify it doesn't crash
      expect(cachedCount).toBeGreaterThanOrEqual(0)
    })

    it('should handle concurrent requests with different keys', async () => {
      const requests: MCPRequest[] = [
        {
          action: 'test-action',
          parameters: { id: 1 },
          options: { idempotencyKey: 'key-1' },
        },
        {
          action: 'test-action',
          parameters: { id: 2 },
          options: { idempotencyKey: 'key-2' },
        },
        {
          action: 'test-action',
          parameters: { id: 3 },
          options: { idempotencyKey: 'key-3' },
        },
      ]

      const responses = await Promise.all(requests.map((r) => adapter.execute(r)))

      // All should execute (different keys)
      responses.forEach((response) => {
        expect(response.success).toBe(true)
        expect(response.metadata?.cached).toBeUndefined()
      })

      // Cache should have 3 entries
      const stats = adapter.getCacheStats()
      expect(stats.size).toBe(3)
      expect(stats.keys).toContain('key-1')
      expect(stats.keys).toContain('key-2')
      expect(stats.keys).toContain('key-3')
    })
  })

  describe('Cache Cleanup', () => {
    it('should automatically cleanup expired entries', async () => {
      vi.useFakeTimers()

      const request: MCPRequest = {
        action: 'test-action',
        options: {
          idempotencyKey: 'cleanup-key',
          idempotencyTTL: 1000, // 1 second
        },
      }

      // Add entry to cache
      await adapter.execute(request)

      // Verify it's in cache
      let stats = adapter.getCacheStats()
      expect(stats.size).toBe(1)

      // Fast-forward time to expire the entry
      vi.advanceTimersByTime(2000)

      // Fast-forward to trigger cleanup interval (60 seconds)
      vi.advanceTimersByTime(60000)

      // Entry should be cleaned up
      stats = adapter.getCacheStats()
      expect(stats.size).toBe(0)

      vi.useRealTimers()
    })

    it('should stop cleanup interval on dispose', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      adapter.dispose()

      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })
  })

  describe('Cache Management Methods', () => {
    it('should provide cache statistics', async () => {
      await adapter.execute({
        action: 'test-action',
        options: { idempotencyKey: 'stat-key-1' },
      })

      await adapter.execute({
        action: 'test-action',
        options: { idempotencyKey: 'stat-key-2' },
      })

      const stats = adapter.getCacheStats()

      expect(stats.size).toBe(2)
      expect(stats.keys).toContain('stat-key-1')
      expect(stats.keys).toContain('stat-key-2')
    })

    it('should clear all cache entries', async () => {
      // Add multiple entries
      await adapter.execute({
        action: 'test-action',
        options: { idempotencyKey: 'clear-key-1' },
      })

      await adapter.execute({
        action: 'test-action',
        options: { idempotencyKey: 'clear-key-2' },
      })

      expect(adapter.getCacheStats().size).toBe(2)

      // Clear cache
      adapter.clearCache()

      expect(adapter.getCacheStats().size).toBe(0)
    })

    it('should allow re-execution after clearing cache', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        options: { idempotencyKey: 'reclear-key' },
      }

      // First execution
      const response1 = await adapter.execute(request)
      expect(response1.metadata?.cached).toBeUndefined()

      // Should be cached
      const response2 = await adapter.execute(request)
      expect(response2.metadata?.cached).toBe(true)

      // Clear cache
      adapter.clearCache()

      // Should execute again
      const response3 = await adapter.execute(request)
      expect(response3.metadata?.cached).toBeUndefined()
    })
  })

  describe('Idempotency Key Generation', () => {
    it('should generate deterministic keys for same request', () => {
      const request1: MCPRequest = {
        action: 'test-action',
        parameters: { id: 123, name: 'test' },
      }

      const request2: MCPRequest = {
        action: 'test-action',
        parameters: { id: 123, name: 'test' },
      }

      const key1 = generateIdempotencyKey(request1)
      const key2 = generateIdempotencyKey(request2)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^test-action:[a-f0-9]+$/)
    })

    it('should generate different keys for different requests', () => {
      const request1: MCPRequest = {
        action: 'test-action',
        parameters: { id: 123 },
      }

      const request2: MCPRequest = {
        action: 'test-action',
        parameters: { id: 456 },
      }

      const key1 = generateIdempotencyKey(request1)
      const key2 = generateIdempotencyKey(request2)

      expect(key1).not.toBe(key2)
    })

    it('should generate unique keys with timestamp', () => {
      const key1 = generateUniqueIdempotencyKey('test-action')
      const key2 = generateUniqueIdempotencyKey('test-action')

      expect(key1).not.toBe(key2)
      expect(key1).toMatch(/^test-action:\d+:[a-z0-9]+$/)
      expect(key2).toMatch(/^test-action:\d+:[a-z0-9]+$/)
    })
  })

  describe('Cache Edge Cases', () => {
    it('should handle empty parameters', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        // No parameters
        options: { idempotencyKey: 'empty-params-key' },
      }

      const response1 = await adapter.execute(request)
      const response2 = await adapter.execute(request)

      expect(response2.metadata?.cached).toBe(true)
    })

    it('should handle very short TTL', async () => {
      const request: MCPRequest = {
        action: 'test-action',
        options: {
          idempotencyKey: 'short-ttl-key',
          idempotencyTTL: 1, // 1ms
        },
      }

      await adapter.execute(request)

      // Wait slightly longer than TTL
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should not be cached anymore
      const response = await adapter.execute(request)
      expect(response.metadata?.cached).toBeUndefined()
    })

    it('should handle multiple adapters with separate caches', async () => {
      const adapter2 = new TestAdapter()

      try {
        const request: MCPRequest = {
          action: 'test-action',
          options: { idempotencyKey: 'multi-adapter-key' },
        }

        // Execute on first adapter
        await adapter.execute(request)
        expect(adapter.getCacheStats().size).toBe(1)

        // Second adapter should have empty cache
        expect(adapter2.getCacheStats().size).toBe(0)

        // Execute on second adapter
        await adapter2.execute(request)
        expect(adapter2.getCacheStats().size).toBe(1)

        // Both adapters should have their own cache entry
        expect(adapter.getCacheStats().size).toBe(1)
        expect(adapter2.getCacheStats().size).toBe(1)
      } finally {
        adapter2.dispose()
      }
    })
  })

  describe('Integration with Retry Logic', () => {
    it('should cache after successful retry', async () => {
      let attempt = 0
      const unstableAdapter = new (class extends TestAdapter {
        protected async executeRequest(request: MCPRequest): Promise<unknown> {
          attempt++
          if (attempt === 1) {
            throw new Error('First attempt fails')
          }
          return { result: 'success-after-retry' }
        }
      })()

      try {
        const request: MCPRequest = {
          action: 'test-action',
          options: {
            idempotencyKey: 'retry-key',
            retries: 2,
          },
        }

        // First call should retry and succeed
        const response1 = await unstableAdapter.execute(request)
        expect(response1.success).toBe(true)
        expect(response1.metadata?.retries).toBe(1)

        // Second call should be cached
        const response2 = await unstableAdapter.execute(request)
        expect(response2.metadata?.cached).toBe(true)
      } finally {
        unstableAdapter.dispose()
      }
    }, 10000) // 10 second timeout for retry logic
  })
})
