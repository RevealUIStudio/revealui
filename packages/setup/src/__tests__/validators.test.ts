import { describe, expect, it } from 'vitest'
import { validateEnv, validators } from '../validators/env.js'

describe('Environment Validators', () => {
  describe('validators.postgresUrl', () => {
    it('accepts postgresql:// URLs', () => {
      expect(validators.postgresUrl('postgresql://user:pass@host/db')).toBe(true)
    })

    it('accepts postgres:// URLs', () => {
      expect(validators.postgresUrl('postgres://user:pass@host/db')).toBe(true)
    })

    it('rejects non-postgres URLs', () => {
      expect(validators.postgresUrl('http://example.com')).toBe(false)
      expect(validators.postgresUrl('mysql://host/db')).toBe(false)
    })

    it('rejects invalid URLs', () => {
      expect(validators.postgresUrl('not-a-url')).toBe(false)
    })
  })

  describe('validators.stripeSecretKey', () => {
    it('accepts sk_test_ keys', () => {
      expect(validators.stripeSecretKey('sk_test_abc123')).toBe(true)
    })

    it('accepts sk_live_ keys', () => {
      expect(validators.stripeSecretKey('sk_live_abc123')).toBe(true)
    })

    it('rejects other formats', () => {
      expect(validators.stripeSecretKey('pk_test_abc123')).toBe(false)
      expect(validators.stripeSecretKey('random-string')).toBe(false)
    })
  })

  describe('validators.stripePublishableKey', () => {
    it('accepts pk_test_ keys', () => {
      expect(validators.stripePublishableKey('pk_test_abc123')).toBe(true)
    })

    it('accepts pk_live_ keys', () => {
      expect(validators.stripePublishableKey('pk_live_abc123')).toBe(true)
    })

    it('rejects other formats', () => {
      expect(validators.stripePublishableKey('sk_test_abc123')).toBe(false)
    })
  })

  describe('validators.url', () => {
    it('accepts valid URLs', () => {
      expect(validators.url('https://example.com')).toBe(true)
      expect(validators.url('http://localhost:3000')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(validators.url('not-a-url')).toBe(false)
    })
  })

  describe('validators.minLength', () => {
    it('accepts strings at or above minimum length', () => {
      const check = validators.minLength(5)
      expect(check('hello')).toBe(true)
      expect(check('hello world')).toBe(true)
    })

    it('rejects strings below minimum length', () => {
      const check = validators.minLength(5)
      expect(check('hi')).toBe(false)
    })
  })

  describe('validators.email', () => {
    it('accepts valid emails', () => {
      expect(validators.email('user@example.com')).toBe(true)
      expect(validators.email('name@domain.co.uk')).toBe(true)
    })

    it('rejects invalid emails', () => {
      expect(validators.email('not-an-email')).toBe(false)
      expect(validators.email('@missing-user.com')).toBe(false)
      expect(validators.email('user@')).toBe(false)
    })
  })

  describe('validateEnv', () => {
    it('returns valid when all required vars are present', () => {
      const result = validateEnv([{ name: 'DB_URL', description: 'Database', required: true }], {
        DB_URL: 'postgresql://host/db',
      })
      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
      expect(result.invalid).toHaveLength(0)
    })

    it('reports missing required vars', () => {
      const result = validateEnv([{ name: 'DB_URL', description: 'Database', required: true }], {})
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('DB_URL')
    })

    it('reports invalid vars that fail validation', () => {
      const result = validateEnv(
        [
          {
            name: 'DB_URL',
            description: 'Database',
            required: true,
            validator: validators.postgresUrl,
          },
        ],
        { DB_URL: 'http://not-postgres' },
      )
      expect(result.valid).toBe(false)
      expect(result.invalid).toContain('DB_URL')
    })

    it('skips validation for missing optional vars', () => {
      const result = validateEnv(
        [{ name: 'OPTIONAL', description: 'Optional', required: false }],
        {},
      )
      expect(result.valid).toBe(true)
    })

    it('validates present optional vars', () => {
      const result = validateEnv(
        [
          {
            name: 'OPTIONAL_URL',
            description: 'Optional URL',
            required: false,
            validator: validators.url,
          },
        ],
        { OPTIONAL_URL: 'not-valid' },
      )
      expect(result.valid).toBe(false)
      expect(result.invalid).toContain('OPTIONAL_URL')
    })
  })
})
