import { describe, expect, it } from 'vitest'
import {
  AuthError,
  AuthenticationError,
  DatabaseError,
  OAuthAccountConflictError,
  SessionError,
  TokenError,
} from '../server/errors'

describe('AuthError', () => {
  it('sets message, code, and statusCode', () => {
    const err = new AuthError('test error', 'TEST_CODE', 403)
    expect(err.message).toBe('test error')
    expect(err.code).toBe('TEST_CODE')
    expect(err.statusCode).toBe(403)
    expect(err.name).toBe('AuthError')
  })

  it('defaults statusCode to 500', () => {
    const err = new AuthError('fail', 'FAIL')
    expect(err.statusCode).toBe(500)
  })

  it('is an instance of Error', () => {
    const err = new AuthError('test', 'CODE')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('SessionError', () => {
  it('defaults to 401 status', () => {
    const err = new SessionError()
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('SESSION_ERROR')
    expect(err.name).toBe('SessionError')
  })

  it('accepts custom message and status', () => {
    const err = new SessionError('expired', 403)
    expect(err.message).toBe('expired')
    expect(err.statusCode).toBe(403)
  })
})

describe('AuthenticationError', () => {
  it('defaults to 401 status', () => {
    const err = new AuthenticationError()
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('AUTHENTICATION_ERROR')
    expect(err.name).toBe('AuthenticationError')
  })

  it('accepts custom message', () => {
    const err = new AuthenticationError('bad credentials')
    expect(err.message).toBe('bad credentials')
  })
})

describe('DatabaseError', () => {
  it('defaults to 500 status', () => {
    const err = new DatabaseError()
    expect(err.statusCode).toBe(500)
    expect(err.code).toBe('DATABASE_ERROR')
    expect(err.name).toBe('DatabaseError')
  })

  it('wraps original Error', () => {
    const original = new Error('connection lost')
    const err = new DatabaseError('DB failed', original)
    expect(err.originalError).toBe(original)
  })

  it('ignores non-Error original', () => {
    const err = new DatabaseError('DB failed', 'string error')
    expect(err.originalError).toBeUndefined()
  })
})

describe('TokenError', () => {
  it('defaults to 401 status', () => {
    const err = new TokenError()
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('TOKEN_ERROR')
    expect(err.name).toBe('TokenError')
  })
})

describe('OAuthAccountConflictError', () => {
  it('stores email and uses 409 status', () => {
    const err = new OAuthAccountConflictError('user@example.com')
    expect(err.statusCode).toBe(409)
    expect(err.code).toBe('OAUTH_ACCOUNT_CONFLICT')
    expect(err.email).toBe('user@example.com')
    expect(err.name).toBe('OAuthAccountConflictError')
    expect(err.message).toContain('already exists')
  })

  it('is an instance of AuthError', () => {
    const err = new OAuthAccountConflictError('test@test.com')
    expect(err).toBeInstanceOf(AuthError)
  })
})
