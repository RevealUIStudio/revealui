/**
 * Authentication Tests
 *
 * Unit tests for authentication functions.
 */

import bcrypt from 'bcryptjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signIn, signUp } from '../server/auth.js'

// Mock database client
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '',
  role: 'viewer',
  status: 'active',
}

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => []),
      })),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => [mockUser]),
    })),
  })),
}

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}))

vi.mock('../server/session', () => ({
  createSession: vi.fn(async () => ({
    token: 'session-token-123',
    session: {
      id: 'session-123',
      userId: 'user-123',
      expiresAt: new Date(),
    },
  })),
}))

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signIn', () => {
    it('should return error if user not found', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => []), // No user found
          })),
        })),
      })

      const result = await signIn('test@example.com', 'password')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should return error if password is invalid', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 12)
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [
              {
                ...mockUser,
                passwordHash: hashedPassword,
              },
            ]),
          })),
        })),
      })

      const result = await signIn('test@example.com', 'wrong-password')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })

    it('should return error if user has no password hash', async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [
              {
                ...mockUser,
                passwordHash: null, // OAuth-only user
              },
            ]),
          })),
        })),
      })

      const result = await signIn('test@example.com', 'password')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password')
    })
  })

  describe('signUp', () => {
    it('should return error if user already exists', async () => {
      // Reset mocks
      vi.clearAllMocks()

      // Mock: user already exists
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [mockUser]), // User exists
          })),
        })),
      })

      // Use password that meets strength requirements
      const result = await signUp('test@example.com', 'Password123', 'Test User')
      expect(result.success).toBe(false)
      expect(result.error).toBe('User with this email already exists')
    })

    it('should create user and session on success', async () => {
      // Reset mocks
      vi.clearAllMocks()

      // Mock: no existing user
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => []), // No existing user
          })),
        })),
      })

      // Mock: successful user creation
      const newUser = {
        ...mockUser,
        id: 'new-user-123',
        email: 'new@example.com',
        name: 'New User',
      }
      mockDb.insert.mockReturnValue({
        values: vi.fn(() => ({
          returning: vi.fn(() => [newUser]),
        })),
      })

      // Use password that meets strength requirements (uppercase, lowercase, number)
      const result = await signUp('new@example.com', 'Password123', 'New User')
      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.sessionToken).toBeDefined()
    })
  })
})
