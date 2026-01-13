/**
 * Session Management Tests
 *
 * Unit tests for session management functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createSession, getSession, deleteSession } from '../server/session'
import type { Headers } from '../types'

// Mock database client
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{
          id: 'session-123',
          userId: 'user-123',
          tokenHash: 'hashed-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
          lastActivityAt: new Date(),
        }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve({ rowCount: 1 })),
    })),
  })),
}))

describe('Session Management', () => {
  describe('createSession', () => {
    it('should create a session with token', async () => {
      const result = await createSession('user-123', {
        persistent: true,
        userAgent: 'test-agent',
        ipAddress: '127.0.0.1',
      })

      expect(result.token).toBeDefined()
      expect(result.session).toBeDefined()
      expect(result.session.userId).toBe('user-123')
    })

    it('should set expiration based on persistent flag', async () => {
      const regular = await createSession('user-123', { persistent: false })
      const persistent = await createSession('user-123', { persistent: true })

      // Persistent sessions should expire later
      expect(persistent.session.expiresAt.getTime()).toBeGreaterThan(
        regular.session.expiresAt.getTime()
      )
    })
  })

  describe('getSession', () => {
    it('should return null if no cookie header', async () => {
      const headers = new Headers()
      const session = await getSession(headers)
      expect(session).toBeNull()
    })

    it('should return null if invalid session token', async () => {
      const headers = new Headers()
      headers.set('cookie', 'revealui-session=invalid-token')
      const session = await getSession(headers)
      // Will return null because session not found in database
      expect(session).toBeNull()
    })
  })

  describe('deleteSession', () => {
    it('should return false if no cookie header', async () => {
      const headers = new Headers()
      const deleted = await deleteSession(headers)
      expect(deleted).toBe(false)
    })
  })
})
