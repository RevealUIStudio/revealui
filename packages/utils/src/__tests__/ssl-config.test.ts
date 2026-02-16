import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSSLConfig, validateSSLConfig } from '../database/ssl-config.js'

describe('SSL Config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getSSLConfig', () => {
    it('returns false when no sslmode is specified', () => {
      expect(getSSLConfig('postgresql://user:pass@host/db')).toBe(false)
    })

    it('returns false when sslmode=disable', () => {
      expect(getSSLConfig('postgresql://user:pass@host/db?sslmode=disable')).toBe(false)
    })

    it('returns { rejectUnauthorized: true } for sslmode=require', () => {
      expect(getSSLConfig('postgresql://user:pass@host/db?sslmode=require')).toEqual({
        rejectUnauthorized: true,
      })
    })

    it('returns { rejectUnauthorized: true } for sslmode=verify-full', () => {
      expect(getSSLConfig('postgresql://user:pass@host/db?sslmode=verify-full')).toEqual({
        rejectUnauthorized: true,
      })
    })

    it('returns { rejectUnauthorized: true } for sslmode=verify-ca', () => {
      expect(getSSLConfig('postgresql://user:pass@host/db?sslmode=verify-ca')).toEqual({
        rejectUnauthorized: true,
      })
    })

    it('returns { rejectUnauthorized: false } with dev override', () => {
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('DATABASE_SSL_REJECT_UNAUTHORIZED', 'false')

      expect(getSSLConfig('postgresql://user:pass@host/db?sslmode=require')).toEqual({
        rejectUnauthorized: false,
      })
    })

    it('ignores dev override in production', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('DATABASE_SSL_REJECT_UNAUTHORIZED', 'false')

      expect(getSSLConfig('postgresql://user:pass@host/db?sslmode=require')).toEqual({
        rejectUnauthorized: true,
      })
    })

    it('returns false for invalid connection strings', () => {
      expect(getSSLConfig('not-a-url')).toBe(false)
    })
  })

  describe('validateSSLConfig', () => {
    it('returns true for SSL-enabled production connection', () => {
      expect(
        validateSSLConfig('postgresql://user:pass@host/db?sslmode=require', 'production'),
      ).toBe(true)
    })

    it('returns false for SSL-disabled production connection', () => {
      expect(validateSSLConfig('postgresql://user:pass@host/db', 'production')).toBe(false)
    })

    it('returns true for any SSL config in development', () => {
      expect(validateSSLConfig('postgresql://user:pass@host/db', 'development')).toBe(true)
    })

    it('returns true for SSL-enabled development connection', () => {
      expect(
        validateSSLConfig('postgresql://user:pass@host/db?sslmode=require', 'development'),
      ).toBe(true)
    })
  })
})
