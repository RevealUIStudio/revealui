import { describe, expect, it } from 'vitest'
import {
  validateNeonUrl,
  validateOpenAIKey,
  validateStripeKey,
  validateSupabaseUrl,
  validateVercelToken,
} from '../validators/credentials.js'

describe('Credential Validators', () => {
  describe('validateStripeKey', () => {
    it('accepts sk_test_ keys', async () => {
      const result = await validateStripeKey('sk_test_abc123')
      expect(result.valid).toBe(true)
    })

    it('accepts sk_live_ keys', async () => {
      const result = await validateStripeKey('sk_live_abc123')
      expect(result.valid).toBe(true)
    })

    it('rejects invalid prefixes', async () => {
      const result = await validateStripeKey('pk_test_abc123')
      expect(result.valid).toBe(false)
      expect(result.message).toBeDefined()
    })
  })

  describe('validateNeonUrl', () => {
    it('accepts postgresql:// URLs', async () => {
      const result = await validateNeonUrl('postgresql://user:pass@host/db')
      expect(result.valid).toBe(true)
    })

    it('accepts postgres:// URLs', async () => {
      const result = await validateNeonUrl('postgres://user:pass@host/db')
      expect(result.valid).toBe(true)
    })

    it('rejects non-postgres URLs', async () => {
      const result = await validateNeonUrl('http://example.com')
      expect(result.valid).toBe(false)
    })

    it('rejects invalid URLs', async () => {
      const result = await validateNeonUrl('not-a-url')
      expect(result.valid).toBe(false)
    })
  })

  describe('validateVercelToken', () => {
    it('accepts tokens with 20+ characters', async () => {
      const result = await validateVercelToken('a'.repeat(20))
      expect(result.valid).toBe(true)
    })

    it('rejects tokens shorter than 20 characters', async () => {
      const result = await validateVercelToken('short')
      expect(result.valid).toBe(false)
    })

    it('rejects empty strings', async () => {
      const result = await validateVercelToken('')
      expect(result.valid).toBe(false)
    })
  })

  describe('validateSupabaseUrl', () => {
    it('accepts valid Supabase URLs', async () => {
      const result = await validateSupabaseUrl('https://myproject.supabase.co')
      expect(result.valid).toBe(true)
    })

    it('accepts non-supabase URLs with a warning', async () => {
      const result = await validateSupabaseUrl('https://example.com')
      expect(result.valid).toBe(true) // valid URL, just warns
    })

    it('rejects invalid URLs', async () => {
      const result = await validateSupabaseUrl('not-a-url')
      expect(result.valid).toBe(false)
    })
  })

  describe('validateOpenAIKey', () => {
    it('accepts keys starting with sk-', async () => {
      const result = await validateOpenAIKey('sk-abc123')
      expect(result.valid).toBe(true)
    })

    it('rejects keys without sk- prefix', async () => {
      const result = await validateOpenAIKey('invalid-key')
      expect(result.valid).toBe(false)
    })
  })
})
