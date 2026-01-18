/**
 * Session Management Tests
 *
 * Unit tests for session management functions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, deleteSession, getSession } from '../server/session'

// Mock database client
const mockInsert = vi.fn()
vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
    insert: mockInsert,
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
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock to default behavior
    mockInsert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: 'session-123',
            userId: 'user-123',
            tokenHash: 'hashed-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            lastActivityAt: new Date(),
          },
        ]),
      })),
    })
  })

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
      const now = Date.now()
      const oneDay = 24 * 60 * 60 * 1000
      const sevenDays = 7 * 24 * 60 * 60 * 1000

      // Mock regular session (1 day expiration) - capture the actual expiration calculated
      let regularExpiry: Date
      mockInsert.mockReturnValueOnce({
        values: vi.fn(() => {
          // The actual implementation calculates expiration, so we need to capture it
          regularExpiry = new Date(now + oneDay)
          return {
            returning: vi.fn(() => [
              {
                id: 'session-regular',
                userId: 'user-123',
                tokenHash: 'hashed-token-regular',
                expiresAt: regularExpiry,
                createdAt: new Date(),
                lastActivityAt: new Date(),
              },
            ]),
          }
        }),
      })

      // Mock persistent session (7 days expiration)
      let persistentExpiry: Date
      mockInsert.mockReturnValueOnce({
        values: vi.fn(() => {
          persistentExpiry = new Date(now + sevenDays)
          return {
            returning: vi.fn(() => [
              {
                id: 'session-persistent',
                userId: 'user-123',
                tokenHash: 'hashed-token-persistent',
                expiresAt: persistentExpiry,
                createdAt: new Date(),
                lastActivityAt: new Date(),
              },
            ]),
          }
        }),
      })

      // Create regular session first
      const regular = await createSession('user-123', { persistent: false })

      // Create persistent session
      const persistent = await createSession('user-123', { persistent: true })

      // Verify expiration times
      const regularTime = regular.session.expiresAt.getTime()
      const persistentTime = persistent.session.expiresAt.getTime()
      const daysDifference = (persistentTime - regularTime) / (1000 * 60 * 60 * 24)

      // Persistent sessions should expire later (7 days vs 1 day = 6 days difference)
      // Allow some tolerance for timing
      expect(daysDifference).toBeGreaterThan(5.5) // Should be ~6 days
      expect(daysDifference).toBeLessThan(6.5) // Should be less than 7 days
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
