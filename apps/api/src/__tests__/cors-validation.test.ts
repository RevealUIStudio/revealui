/**
 * CORS Validation Test - Production Blocker #2 Verification
 *
 * Verifies that CORS configuration is properly validated in production:
 * 1. Throws error if CORS_ORIGIN is not set
 * 2. Throws error if CORS_ORIGIN is empty string
 * 3. Throws error if CORS_ORIGIN contains only whitespace
 * 4. Accepts valid comma-separated origins
 *
 * @see docs/PRODUCTION_BLOCKERS.md - Critical Fix #2
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
  })

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('throws error when CORS_ORIGIN is not set', () => {
      delete process.env.CORS_ORIGIN

      expect(() => getCorsOrigins()).toThrow('PRODUCTION BLOCKER: CORS_ORIGIN')
    })

    it('throws error when CORS_ORIGIN is empty string', () => {
      process.env.CORS_ORIGIN = ''

      expect(() => getCorsOrigins()).toThrow('PRODUCTION BLOCKER: CORS_ORIGIN')
    })

    it('throws error when CORS_ORIGIN contains only whitespace', () => {
      process.env.CORS_ORIGIN = '   ,  ,   '

      expect(() => getCorsOrigins()).toThrow('PRODUCTION BLOCKER: CORS_ORIGIN')
    })

    it('throws error when CORS_ORIGIN has only commas', () => {
      process.env.CORS_ORIGIN = ',,,'

      expect(() => getCorsOrigins()).toThrow('PRODUCTION BLOCKER: CORS_ORIGIN')
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

  describe('Error Message Quality', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
      delete process.env.CORS_ORIGIN
    })

    it('error message mentions production blocker', () => {
      try {
        getCorsOrigins()
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toContain('PRODUCTION BLOCKER')
      }
    })

    it('error message explains the impact', () => {
      try {
        getCorsOrigins()
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toContain('all cross-origin requests will be blocked')
      }
    })

    it('error message provides example', () => {
      try {
        getCorsOrigins()
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toMatch(/Example:.*CORS_ORIGIN=/)
      }
    })
  })
})

/**
 * Success Criteria:
 * ✅ All 13 tests passing = CORS validation prevents production misconfigurations
 * ❌ Any test failing = Critical regression requiring immediate fix
 *
 * What This Verifies:
 * 1. Production: CORS_ORIGIN must be set and non-empty
 * 2. Development: Works without CORS_ORIGIN (uses localhost)
 * 3. Edge cases: Empty strings, whitespace, commas are filtered
 * 4. Error messages are clear and actionable
 * 5. Prevents silent failures that would block all requests
 */
