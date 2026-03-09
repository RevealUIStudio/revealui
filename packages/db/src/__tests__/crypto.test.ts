import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptApiKey, encryptApiKey, redactApiKey } from '../crypto.js'

// ---------------------------------------------------------------------------
// Test KEK — 64 hex chars (32 bytes / 256 bits)
// ---------------------------------------------------------------------------
const TEST_KEK = randomBytes(32).toString('hex')

describe('crypto — BYOK API key encryption', () => {
  const originalEnv = process.env.REVEALUI_KEK

  beforeEach(() => {
    process.env.REVEALUI_KEK = TEST_KEK
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REVEALUI_KEK = originalEnv
    } else {
      delete process.env.REVEALUI_KEK
    }
  })

  describe('encryptApiKey', () => {
    it('returns a dot-separated string with 3 parts', () => {
      const encrypted = encryptApiKey('sk-test-key-12345678')

      const parts = encrypted.split('.')
      expect(parts).toHaveLength(3)
    })

    it('produces different ciphertext for each call (random IV)', () => {
      const a = encryptApiKey('sk-test-key-12345678')
      const b = encryptApiKey('sk-test-key-12345678')

      expect(a).not.toBe(b)
    })

    it('throws when REVEALUI_KEK is not set', () => {
      delete process.env.REVEALUI_KEK

      expect(() => encryptApiKey('sk-test')).toThrow('REVEALUI_KEK environment variable is not set')
    })

    it('throws when REVEALUI_KEK is wrong length', () => {
      process.env.REVEALUI_KEK = 'abc123'

      expect(() => encryptApiKey('sk-test')).toThrow('64 hex characters')
    })

    it('encrypts empty string without error', () => {
      const encrypted = encryptApiKey('')
      expect(encrypted.split('.')).toHaveLength(3)
    })

    it('encrypts long keys', () => {
      const longKey = `sk-${'a'.repeat(500)}`
      const encrypted = encryptApiKey(longKey)
      expect(encrypted.split('.')).toHaveLength(3)
    })

    it('encrypts keys with special characters', () => {
      const key = 'sk-ant-api03-special/+=chars!@#$%^&*()'
      const encrypted = encryptApiKey(key)
      expect(encrypted.split('.')).toHaveLength(3)
    })
  })

  describe('decryptApiKey', () => {
    it('roundtrips encrypt → decrypt correctly', () => {
      const plaintext = 'sk-ant-api03-realkey12345678'
      const encrypted = encryptApiKey(plaintext)
      const decrypted = decryptApiKey(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('roundtrips with unicode content', () => {
      const plaintext = 'key-with-émojis-🔑-and-日本語'
      const encrypted = encryptApiKey(plaintext)
      const decrypted = decryptApiKey(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('throws on invalid format (missing parts)', () => {
      expect(() => decryptApiKey('just-one-part')).toThrow('Invalid encrypted key format')
    })

    it('throws on invalid format (too many parts)', () => {
      expect(() => decryptApiKey('a.b.c.d')).toThrow('Invalid encrypted key format')
    })

    it('throws on tampered ciphertext (GCM auth check)', () => {
      const encrypted = encryptApiKey('sk-original')
      const parts = encrypted.split('.')

      // Tamper with ciphertext
      const tampered = [parts[0], parts[1], 'AAAA'].join('.')

      expect(() => decryptApiKey(tampered)).toThrow()
    })

    it('throws on tampered auth tag', () => {
      const encrypted = encryptApiKey('sk-original')
      const parts = encrypted.split('.')

      // Tamper with auth tag (replace with valid-length but wrong tag)
      const fakeTag = randomBytes(16).toString('base64url')
      const tampered = [parts[0], fakeTag, parts[2]].join('.')

      expect(() => decryptApiKey(tampered)).toThrow()
    })

    it('throws when decrypting with wrong KEK', () => {
      const encrypted = encryptApiKey('sk-secret')

      // Change KEK
      process.env.REVEALUI_KEK = randomBytes(32).toString('hex')

      expect(() => decryptApiKey(encrypted)).toThrow()
    })

    it('throws on invalid IV length', () => {
      const shortIv = randomBytes(4).toString('base64url')
      const authTag = randomBytes(16).toString('base64url')
      const ciphertext = randomBytes(20).toString('base64url')

      expect(() => decryptApiKey(`${shortIv}.${authTag}.${ciphertext}`)).toThrow(
        'Invalid IV length',
      )
    })

    it('throws on invalid auth tag length', () => {
      const iv = randomBytes(12).toString('base64url')
      const shortAuthTag = randomBytes(4).toString('base64url')
      const ciphertext = randomBytes(20).toString('base64url')

      expect(() => decryptApiKey(`${iv}.${shortAuthTag}.${ciphertext}`)).toThrow(
        'Invalid auth tag length',
      )
    })
  })

  describe('redactApiKey', () => {
    it('shows last 4 characters with prefix', () => {
      expect(redactApiKey('sk-ant-api03-12345678')).toBe('...5678')
    })

    it('returns "..." for very short keys', () => {
      expect(redactApiKey('abc')).toBe('...')
      expect(redactApiKey('abcd')).toBe('...')
    })

    it('returns "..." for empty string', () => {
      expect(redactApiKey('')).toBe('...')
    })

    it('redacts 5-character key correctly', () => {
      expect(redactApiKey('12345')).toBe('...2345')
    })

    it('never exposes more than 4 characters', () => {
      const hint = redactApiKey('very-long-api-key-with-many-chars')
      expect(hint).toBe('...hars')
      // redactApiKey shows last 4 chars
      expect(hint.replace('...', '')).toHaveLength(4)
    })
  })
})
