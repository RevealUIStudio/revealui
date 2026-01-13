/**
 * Authentication Flow Integration Tests
 *
 * Integration tests for complete authentication flows.
 * These tests require a database connection.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { signIn, signUp } from '../../server/auth'
import { getSession, deleteSession } from '../../server/session'
import { getClient } from '@revealui/db/client'
import { users, sessions } from '@revealui/db/core'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

// Skip integration tests if DATABASE_URL is not set
const shouldSkip = !process.env.DATABASE_URL && !process.env.POSTGRES_URL

describe.skipIf(shouldSkip)('Authentication Flow Integration', () => {
  let testUserId: string
  let testEmail: string
  let testPassword: string

  beforeAll(async () => {
    // Generate test credentials
    testEmail = `test-${Date.now()}@example.com`
    testPassword = 'TestPassword123!'
  })

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      const db = getClient()
      await db.delete(sessions).where(eq(sessions.userId, testUserId))
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

  describe('Sign Up Flow', () => {
    it('should create a new user and session', async () => {
      const result = await signUp(testEmail, testPassword, 'Test User', {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.email).toBe(testEmail)
      expect(result.sessionToken).toBeDefined()

      testUserId = result.user!.id
    })

    it('should fail if email already exists', async () => {
      const result = await signUp(testEmail, testPassword, 'Another User')
      expect(result.success).toBe(false)
      expect(result.error).toContain('already exists')
    })
  })

  describe('Sign In Flow', () => {
    it('should sign in with correct credentials', async () => {
      const result = await signIn(testEmail, testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.email).toBe(testEmail)
      expect(result.sessionToken).toBeDefined()
    })

    it('should fail with incorrect password', async () => {
      const result = await signIn(testEmail, 'WrongPassword', {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('should fail with non-existent email', async () => {
      const result = await signIn('nonexistent@example.com', testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })
  })

  describe('Session Management', () => {
    let sessionToken: string
    let headers: Headers

    beforeAll(async () => {
      // Create a session for testing
      const result = await signIn(testEmail, testPassword, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })
      sessionToken = result.sessionToken!
      headers = new Headers()
      headers.set('cookie', `revealui-session=${sessionToken}`)
    })

    it('should get session from headers', async () => {
      const session = await getSession(headers)
      expect(session).toBeDefined()
      expect(session?.user.id).toBe(testUserId)
      expect(session?.user.email).toBe(testEmail)
    })

    it('should return null for invalid session', async () => {
      const invalidHeaders = new Headers()
      invalidHeaders.set('cookie', 'revealui-session=invalid-token')
      const session = await getSession(invalidHeaders)
      expect(session).toBeNull()
    })

    it('should delete session', async () => {
      const deleted = await deleteSession(headers)
      expect(deleted).toBe(true)

      // Verify session is deleted
      const session = await getSession(headers)
      expect(session).toBeNull()
    })
  })
})
