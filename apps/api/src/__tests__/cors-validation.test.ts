/**
 * CORS Validation Test - Production Blocker #2 Verification
 *
 * Verifies that CORS configuration is properly validated in production:
 * 1. Returns [] and logs error if CORS_ORIGIN is not set (does not throw — Session 15)
 * 2. Returns [] and logs error if CORS_ORIGIN is empty string
 * 3. Returns [] and logs error if CORS_ORIGIN contains only whitespace
 * 4. Accepts valid comma-separated origins
 *
 * Note: Session 15 changed from throw → logger.error to prevent cold-start kills
 * on Railway/Vercel where a module-init throw makes the health check unreachable.
 *
 * @see docs/PRODUCTION_BLOCKERS.md - Critical Fix #2
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Block the pnpm-store @revealui/ai import chain before index.js is loaded.
// @revealui/ai@^0.1.0 resolves to npm store → pulls @revealui/config@0.2.0
// whose dist/loader is missing. Mocking here prevents that ERR_MODULE_NOT_FOUND.
// All @revealui/ai subpath mocks — prevents pnpm-store chain from loading
// @revealui/config@0.2.0 (broken dist/loader) via @revealui/ai@0.1.x (npm, not workspace)
vi.mock('@revealui/ai', () => ({
  agentCardRegistry: {
    getCard: vi.fn(),
    listCards: vi.fn().mockReturnValue([]),
    has: vi.fn().mockReturnValue(false),
    getDef: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn().mockReturnValue(false),
    update: vi.fn(),
  },
  handleA2AJsonRpc: vi.fn().mockResolvedValue({ jsonrpc: '2.0', id: null, result: {} }),
  getTask: vi.fn(),
  createLLMClientFromEnv: vi.fn(),
  TicketAgentDispatcher: class TicketAgentDispatcher {},
  RPC_PARSE_ERROR: -32700,
  RPC_INVALID_REQUEST: -32600,
}))
vi.mock('@revealui/ai/llm/server', () => ({
  createLLMClientForUser: vi.fn(),
  LLMClient: class LLMClient {},
}))
vi.mock('@revealui/ai/llm/key-validator', () => ({
  validateProviderKey: vi.fn().mockResolvedValue({ valid: true }),
}))
vi.mock('@revealui/ai/orchestration/streaming-runtime', () => ({
  StreamingAgentRuntime: class StreamingAgentRuntime {},
}))
vi.mock('@revealui/ai/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([]),
}))
vi.mock('@revealui/ai/ingestion', () => ({
  IngestionPipeline: class IngestionPipeline {},
}))

import { logger } from '@revealui/core/observability/logger'
import { getCorsOrigins } from '../index.js'

describe('Critical Fix #2: CORS Validation', () => {
  let originalNodeEnv: string | undefined
  let originalCorsOrigin: string | undefined

  beforeEach(() => {
    // Save original env vars
    originalNodeEnv = process.env.NODE_ENV
    originalCorsOrigin = process.env.CORS_ORIGIN
  })

  afterEach(() => {
    // Restore original env vars
    process.env.NODE_ENV = originalNodeEnv
    process.env.CORS_ORIGIN = originalCorsOrigin
    vi.restoreAllMocks()
  })

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('returns empty array when CORS_ORIGIN is not set', () => {
      delete process.env.CORS_ORIGIN

      expect(getCorsOrigins()).toEqual([])
    })

    it('returns empty array when CORS_ORIGIN is empty string', () => {
      process.env.CORS_ORIGIN = ''

      expect(getCorsOrigins()).toEqual([])
    })

    it('returns empty array when CORS_ORIGIN contains only whitespace', () => {
      process.env.CORS_ORIGIN = '   ,  ,   '

      expect(getCorsOrigins()).toEqual([])
    })

    it('returns empty array when CORS_ORIGIN has only commas', () => {
      process.env.CORS_ORIGIN = ',,,'

      expect(getCorsOrigins()).toEqual([])
    })

    it('accepts valid single origin', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com'

      const origins = getCorsOrigins()
      expect(origins).toEqual(['https://app.example.com'])
    })

    it('accepts valid comma-separated origins', () => {
      process.env.CORS_ORIGIN = 'https://app.example.com,https://www.example.com'

      const origins = getCorsOrigins()
      expect(origins).toEqual(['https://app.example.com', 'https://www.example.com'])
    })

    it('accepts origins with whitespace (trimmed)', () => {
      process.env.CORS_ORIGIN = ' https://app.example.com , https://www.example.com '

      const origins = getCorsOrigins()
      expect(origins).toEqual(['https://app.example.com', 'https://www.example.com'])
    })

    it('filters out empty strings from comma-separated list', () => {
      // This should work because valid origins exist after filtering
      process.env.CORS_ORIGIN = 'https://app.example.com, , ,https://www.example.com'

      const origins = getCorsOrigins()
      expect(origins).toEqual(['https://app.example.com', 'https://www.example.com'])
    })
  })

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development'
    })

    it('allows missing CORS_ORIGIN in development', () => {
      delete process.env.CORS_ORIGIN

      const origins = getCorsOrigins()
      expect(origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
      ])
    })

    it('uses localhost origins by default in development', () => {
      delete process.env.CORS_ORIGIN

      const origins = getCorsOrigins()
      expect(origins).toContain('http://localhost:3000')
      expect(origins.length).toBe(3)
    })
  })

  describe('Warn Behavior (no throw)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      delete process.env.CORS_ORIGIN
    })

    it('does not throw — logs error instead to allow cold-start health checks', () => {
      vi.spyOn(logger, 'error').mockImplementation(() => {})
      expect(() => getCorsOrigins()).not.toThrow()
    })

    it('warn message explains that cross-origin requests will be blocked', () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
      getCorsOrigins()
      const message = errorSpy.mock.calls[0]?.[0] as string
      expect(message).toContain('all cross-origin requests will be blocked')
    })

    it('warn message references CORS_ORIGIN so the operator knows what to fix', () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
      getCorsOrigins()
      const message = errorSpy.mock.calls[0]?.[0] as string
      expect(message).toContain('CORS_ORIGIN')
    })
  })
})

/**
 * Success Criteria:
 * ✅ All 13 tests passing = CORS validation prevents production misconfigurations
 * ❌ Any test failing = Critical regression requiring immediate fix
 *
 * What This Verifies:
 * 1. Production: Missing CORS_ORIGIN returns [] and logs error (no throw — Session 15)
 * 2. Development: Works without CORS_ORIGIN (uses localhost)
 * 3. Edge cases: Empty strings, whitespace, commas are filtered → []
 * 4. Logger warnings are clear and reference CORS_ORIGIN
 * 5. Function never throws — allows health checks to respond on misconfigured deploys
 */
