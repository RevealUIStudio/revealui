/**
 * Validation Utilities Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateEnv, detectEnvironment, isCI, REQUIRED_ENV_VARS } from '../lib/validation/env.js'
import { detectDatabaseProvider, parseConnectionString } from '../lib/validation/database.js'

describe('validateEnv', () => {
  it('should return valid when all required variables are set', () => {
    const env = {
      REVEALUI_SECRET: 'a'.repeat(32),
      POSTGRES_URL: 'postgresql://user:pass@host:5432/db',
    }

    const result = validateEnv(REQUIRED_ENV_VARS, env)

    expect(result.valid).toBe(true)
    expect(result.missing).toHaveLength(0)
    expect(result.invalid).toHaveLength(0)
  })

  it('should return missing variables', () => {
    const env = {}

    const result = validateEnv(REQUIRED_ENV_VARS, env)

    expect(result.valid).toBe(false)
    expect(result.missing).toContain('REVEALUI_SECRET')
    expect(result.missing).toContain('POSTGRES_URL')
  })

  it('should return invalid when validation fails', () => {
    const env = {
      REVEALUI_SECRET: 'tooshort',
      POSTGRES_URL: 'not-a-valid-url',
    }

    const result = validateEnv(REQUIRED_ENV_VARS, env)

    expect(result.valid).toBe(false)
    expect(result.invalid).toContain('REVEALUI_SECRET')
    expect(result.invalid).toContain('POSTGRES_URL')
  })

  it('should accept DATABASE_URL as fallback for POSTGRES_URL', () => {
    const env = {
      REVEALUI_SECRET: 'a'.repeat(32),
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
    }

    const result = validateEnv(REQUIRED_ENV_VARS, env)

    expect(result.valid).toBe(true)
    expect(result.warnings).toContain('Using DATABASE_URL as fallback for POSTGRES_URL')
  })
})

describe('detectEnvironment', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should detect CI environment', () => {
    process.env.CI = 'true'

    expect(detectEnvironment()).toBe('ci')
  })

  it('should detect test environment', () => {
    delete process.env.CI
    process.env.NODE_ENV = 'test'

    expect(detectEnvironment()).toBe('test')
  })

  it('should detect production environment', () => {
    delete process.env.CI
    process.env.NODE_ENV = 'production'

    expect(detectEnvironment()).toBe('production')
  })

  it('should default to development', () => {
    delete process.env.CI
    process.env.NODE_ENV = 'development'

    expect(detectEnvironment()).toBe('development')
  })
})

describe('isCI', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should detect CI environment variable', () => {
    process.env.CI = 'true'
    expect(isCI()).toBe(true)
  })

  it('should detect GitHub Actions', () => {
    delete process.env.CI
    process.env.GITHUB_ACTIONS = 'true'
    expect(isCI()).toBe(true)
  })

  it('should detect GitLab CI', () => {
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    process.env.GITLAB_CI = 'true'
    expect(isCI()).toBe(true)
  })

  it('should return false when not in CI', () => {
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.CIRCLECI
    delete process.env.TRAVIS
    delete process.env.JENKINS_URL
    expect(isCI()).toBe(false)
  })
})

describe('detectDatabaseProvider', () => {
  it('should detect Neon database', () => {
    expect(detectDatabaseProvider('postgresql://user@ep-xyz.neon.tech/db')).toBe('neon')
    expect(detectDatabaseProvider('postgres://user@neon.database.windows.net/db')).toBe('neon')
  })

  it('should detect Supabase database', () => {
    expect(detectDatabaseProvider('postgresql://user@db.supabase.co/db')).toBe('supabase')
    expect(detectDatabaseProvider('postgresql://user@aws-0-us-east-1.pooler.supabase.com/db')).toBe('supabase')
  })

  it('should detect generic PostgreSQL', () => {
    expect(detectDatabaseProvider('postgresql://user@localhost:5432/db')).toBe('postgres')
    expect(detectDatabaseProvider('postgres://user@my-server.com/db')).toBe('postgres')
  })

  it('should return unknown for non-postgres URLs', () => {
    expect(detectDatabaseProvider('mysql://user@localhost/db')).toBe('unknown')
    expect(detectDatabaseProvider('invalid-url')).toBe('unknown')
  })
})

describe('parseConnectionString', () => {
  it('should parse a valid connection string', () => {
    const result = parseConnectionString('postgresql://user:password@host:5432/database?sslmode=require')

    expect(result).not.toBeNull()
    expect(result?.host).toBe('host')
    expect(result?.port).toBe(5432)
    expect(result?.database).toBe('database')
    expect(result?.user).toBe('user')
    expect(result?.password).toBe('password')
    expect(result?.ssl).toBe(true)
  })

  it('should use default port when not specified', () => {
    const result = parseConnectionString('postgresql://user:password@host/database')

    expect(result).not.toBeNull()
    expect(result?.port).toBe(5432)
  })

  it('should return null for invalid URL', () => {
    const result = parseConnectionString('not-a-valid-url')

    expect(result).toBeNull()
  })

  it('should detect ssl=disable', () => {
    const result = parseConnectionString('postgresql://user:pass@host/db?sslmode=disable')

    expect(result).not.toBeNull()
    expect(result?.ssl).toBe(false)
  })
})
