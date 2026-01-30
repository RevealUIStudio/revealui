/**
 * Session Management Integration Tests
 *
 * Tests session creation, retrieval, deletion, and expiration
 * using a real database connection.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cleanupTestData,
  createTestUser,
  getTestDatabaseUrl,
} from '../../../tests/integration/setup.js'
import {
  createSession,
  deleteAllUserSessions,
  deleteSession,
  getSession,
} from '../../server/session.js'
import { hashToken } from '../../utils/token.js'

describe('Session Management Integration Tests', () => {
  // Verify database is configured before running tests
  beforeAll(() => {
    getTestDatabaseUrl() // Throws clear error if not configured
  })
  const testUserIds: string[] = []

  afterAll(async () => {
    // Clean up all test data
    await cleanupTestData(testUserIds)
  })

  describe('createSession', () => {
    it('should create a session for a user', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const { token, session } = await createSession(user.id, {
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(token).toBeDefined()
      expect(session).toBeDefined()
      expect(session.userId).toBe(user.id)
      expect(session.userAgent).toBe('test-agent')
      expect(session.ipAddress).toBe('127.0.0.1')
    })

    it('should create a persistent session with 7-day expiration', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const { session } = await createSession(user.id, {
        persistent: true,
      })

      const expiresAt = new Date(session.expiresAt)
      const now = new Date()
      const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

      expect(daysUntilExpiry).toBeGreaterThan(6)
      expect(daysUntilExpiry).toBeLessThan(8)
      expect(session.persistent).toBe(true)
    })

    it('should create a regular session with 1-day expiration', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const { session } = await createSession(user.id, {
        persistent: false,
      })

      const expiresAt = new Date(session.expiresAt)
      const now = new Date()
      const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

      expect(daysUntilExpiry).toBeGreaterThan(0.9)
      expect(daysUntilExpiry).toBeLessThan(1.1)
      expect(session.persistent).toBe(false)
    })
  })

  describe('getSession', () => {
    it('should retrieve a valid session', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const { token } = await createSession(user.id)
      const tokenHash = hashToken(token)

      // Create headers with cookie
      const headers = new Headers()
      headers.set('cookie', `revealui-session=${token}`)

      const sessionData = await getSession(headers)

      expect(sessionData).not.toBeNull()
      expect(sessionData?.user.id).toBe(user.id)
      expect(sessionData?.session.tokenHash).toBe(tokenHash)
    })

    it('should return null for invalid token', async () => {
      const headers = new Headers()
      headers.set('cookie', 'revealui-session=invalid-token')

      const sessionData = await getSession(headers)

      expect(sessionData).toBeNull()
    })

    it('should return null for expired session', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1) // 1 day ago

      const { token } = await createSession(user.id)
      const tokenHash = hashToken(token)

      // Update session to be expired
      const { getClient } = await import('@revealui/db/client')
      const { sessions } = await import('@revealui/db/schema')
      const { eq } = await import('drizzle-orm')
      const db = getClient()
      await db
        .update(sessions)
        .set({ expiresAt: expiredDate })
        .where(eq(sessions.tokenHash, tokenHash))

      const headers = new Headers()
      headers.set('cookie', `revealui-session=${token}`)

      const sessionData = await getSession(headers)

      expect(sessionData).toBeNull()
    })

    it('should return null when cookie is missing', async () => {
      const headers = new Headers()

      const sessionData = await getSession(headers)

      expect(sessionData).toBeNull()
    })

    it('should update lastActivityAt on session access', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const { token, session: createdSession } = await createSession(user.id)

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 100))

      const headers = new Headers()
      headers.set('cookie', `revealui-session=${token}`)

      await getSession(headers)

      // Verify lastActivityAt was updated
      const { getClient } = await import('@revealui/db/client')
      const { sessions } = await import('@revealui/db/schema')
      const { eq } = await import('drizzle-orm')
      const db = getClient()
      const [updatedSession] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, createdSession.id))
        .limit(1)

      expect(updatedSession?.lastActivityAt).toBeDefined()
      if (updatedSession?.lastActivityAt && createdSession.lastActivityAt) {
        expect(new Date(updatedSession.lastActivityAt).getTime()).toBeGreaterThan(
          new Date(createdSession.lastActivityAt).getTime(),
        )
      }
    })
  })

  describe('deleteSession', () => {
    it('should delete a session by token', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      const { token } = await createSession(user.id)

      const headers = new Headers()
      headers.set('cookie', `revealui-session=${token}`)

      const deleted = await deleteSession(headers)

      expect(deleted).toBe(true)

      // Verify session is gone
      const sessionData = await getSession(headers)
      expect(sessionData).toBeNull()
    })

    it('should return false for invalid token', async () => {
      const headers = new Headers()
      headers.set('cookie', 'revealui-session=invalid-token')

      const deleted = await deleteSession(headers)

      expect(deleted).toBe(false)
    })
  })

  describe('deleteAllUserSessions', () => {
    it('should delete all sessions for a user', async () => {
      const user = await createTestUser()
      testUserIds.push(user.id)

      // Create multiple sessions
      const { token: token1 } = await createSession(user.id)
      const { token: token2 } = await createSession(user.id)
      const { token: token3 } = await createSession(user.id)

      // Verify all sessions exist
      const headers1 = new Headers()
      headers1.set('cookie', `revealui-session=${token1}`)
      const headers2 = new Headers()
      headers2.set('cookie', `revealui-session=${token2}`)
      const headers3 = new Headers()
      headers3.set('cookie', `revealui-session=${token3}`)

      expect(await getSession(headers1)).not.toBeNull()
      expect(await getSession(headers2)).not.toBeNull()
      expect(await getSession(headers3)).not.toBeNull()

      // Delete all sessions
      await deleteAllUserSessions(user.id)

      // Verify all sessions are gone
      expect(await getSession(headers1)).toBeNull()
      expect(await getSession(headers2)).toBeNull()
      expect(await getSession(headers3)).toBeNull()
    })
  })
})
