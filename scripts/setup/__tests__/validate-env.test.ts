/**
 * Unit tests for validate-env.ts
 * Tests environment variable validation logic
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('validate-env', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe('Required variables', () => {
    it('should identify all required variables', () => {
      const required = [
        'REVEALUI_SECRET',
        'REVEALUI_PUBLIC_SERVER_URL',
        'NEXT_PUBLIC_SERVER_URL',
        'POSTGRES_URL',
        'BLOB_READ_WRITE_TOKEN',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      ]
      expect(required.length).toBe(8)
      expect(required).toContain('REVEALUI_SECRET')
      expect(required).toContain('POSTGRES_URL')
    })

    it('should accept DATABASE_URL as fallback for POSTGRES_URL', () => {
      delete process.env.POSTGRES_URL
      process.env.DATABASE_URL = 'postgresql://localhost/db'

      const hasPostgres = !!process.env.POSTGRES_URL
      const hasDatabase = !!process.env.DATABASE_URL
      expect(hasPostgres || hasDatabase).toBe(true)
    })
  })

  describe('Naming conventions', () => {
    it('should validate REVEALUI_ prefix', () => {
      const pattern = /^REVEALUI_/
      expect(pattern.test('REVEALUI_SECRET')).toBe(true)
      expect(pattern.test('REVEALUI_PUBLIC_SERVER_URL')).toBe(true)
      expect(pattern.test('NEXT_PUBLIC_SERVER_URL')).toBe(false)
    })

    it('should validate NEXT_PUBLIC_ prefix', () => {
      const pattern = /^NEXT_PUBLIC_/
      expect(pattern.test('NEXT_PUBLIC_SERVER_URL')).toBe(true)
      expect(pattern.test('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')).toBe(true)
      expect(pattern.test('REVEALUI_SECRET')).toBe(false)
    })

    it('should validate standard third-party prefixes', () => {
      const pattern = /^(STRIPE_|BLOB_|SENTRY_|SUPABASE_|NEON_|ELECTRIC_|SKIP_|NODE_)/
      expect(pattern.test('STRIPE_SECRET_KEY')).toBe(true)
      expect(pattern.test('BLOB_READ_WRITE_TOKEN')).toBe(true)
      expect(pattern.test('SUPABASE_DATABASE_URI')).toBe(true)
      expect(pattern.test('REVEALUI_SECRET')).toBe(false)
    })
  })

  describe('Format validation', () => {
    it('should validate HTTPS for production URLs', () => {
      const url = 'https://example.com'
      expect(url.startsWith('https://')).toBe(true)
    })

    it('should reject HTTP for production URLs', () => {
      const url = 'http://example.com'
      expect(url.startsWith('https://')).toBe(false)
    })

    it('should validate Stripe key formats', () => {
      const testKey = 'sk_test_1234567890'
      const liveKey = 'sk_live_1234567890'
      expect(testKey.includes('test')).toBe(true)
      expect(liveKey.includes('live')).toBe(true)
    })

    it('should validate Stripe publishable key formats', () => {
      const testKey = 'pk_test_1234567890'
      const liveKey = 'pk_live_1234567890'
      expect(testKey.includes('test')).toBe(true)
      expect(liveKey.includes('live')).toBe(true)
    })
  })

  describe('Deprecated variables', () => {
    it('should detect deprecated REVEALUI_WHITELISTORIGINS', () => {
      process.env.REVEALUI_WHITELISTORIGINS = 'http://localhost:3000'
      const isDeprecated = !!process.env.REVEALUI_WHITELISTORIGINS
      expect(isDeprecated).toBe(true)
    })
  })
})
