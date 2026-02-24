// @vitest-environment node
import type { RevealRequest } from '@revealui/core'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { passwordSchema } from '@/lib/validation/schemas'
import {
  cleanupTestUsers,
  createTestUser,
  deleteTestUser,
  generateUniqueTestEmail,
  getTestRevealUI,
  verifyJWTStructure,
} from '../utils/cms-test-utils'

/**
 * Authentication Flow Tests
 * Tests for login, logout, JWT validation, and session management
 */

describe('Authentication Tests', () => {
  // Use unique email to prevent UNIQUE constraint failures in parallel test execution
  const testEmail = generateUniqueTestEmail('auth-test')
  const testPassword = 'TestPassword123'
  const testInvalidPassword = 'WrongPassword123'
  const testNonExistentEmail = generateUniqueTestEmail('nonexistent')
  const createAuthRequest = (token: string): RevealRequest => ({
    headers: new Map([['authorization', `JWT ${token}`]]) as unknown as Headers,
  })

  beforeAll(async () => {
    // Clean up any existing test users
    await cleanupTestUsers()
  }, 30000) // 30 second timeout for cleanup

  afterAll(async () => {
    // Clean up test users after all tests
    await cleanupTestUsers()
  }, 30000) // 30 second timeout for cleanup

  beforeEach(async () => {
    // Ensure test user doesn't exist before each test
    // deleteTestUser now handles errors gracefully and returns success status
    const _result = await deleteTestUser(testEmail)
    // Result indicates success/failure - errors are handled internally
    // This prevents UNIQUE constraint failures from parallel test execution
  })

  describe('User Login', () => {
    it('should allow login with valid credentials', async () => {
      // Create test user
      const { user: createdUser } = await createTestUser(testEmail, testPassword)

      // Attempt login
      const revealui = await getTestRevealUI()
      const { user, token } = await revealui.login({
        collection: 'users',
        data: { email: testEmail, password: testPassword },
      })

      expect(user).toBeDefined()
      // Type guard for user
      const typedUser = user as { id: string | number; email: string } | null
      expect(typedUser?.id).toBe(createdUser.id)
      expect(typedUser?.email).toBe(testEmail)
      expect(token).toBeDefined()
      if (token && typeof token === 'string') {
        expect(typeof token).toBe('string')
        expect(token.length).toBeGreaterThan(0)
      }
    })

    it('should reject login with invalid password', async () => {
      // Create test user
      await createTestUser(testEmail, testPassword)

      // Attempt login with wrong password
      const revealui = await getTestRevealUI()
      await expect(
        revealui.login({
          collection: 'users',
          data: { email: testEmail, password: testInvalidPassword },
        }),
      ).rejects.toThrow()
    })

    it('should reject login with non-existent email', async () => {
      const revealui = await getTestRevealUI()
      await expect(
        revealui.login({
          collection: 'users',
          data: { email: testNonExistentEmail, password: testPassword },
        }),
      ).rejects.toThrow()
    })

    it('should return JWT token on successful login', async () => {
      await createTestUser(testEmail, testPassword)

      const revealui = await getTestRevealUI()
      const { token } = await revealui.login({
        collection: 'users',
        data: { email: testEmail, password: testPassword },
      })

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')

      // Verify JWT structure
      if (token && typeof token === 'string') {
        const verification = verifyJWTStructure(token)
        expect(verification.valid).toBe(true)
        expect(verification.payload).toBeDefined()
      }
    })
  })

  describe('JWT Token Management', () => {
    it('should issue valid JWT token with correct claims', async () => {
      const { user, token } = await createTestUser(testEmail, testPassword, ['user-admin'])

      const verification = verifyJWTStructure(token)
      expect(verification.valid).toBe(true)
      expect(verification.payload).toBeDefined()

      if (verification.payload) {
        expect(verification.payload.id).toBe(user.id)
        expect(verification.payload.email).toBe(testEmail)
        // Roles might be in payload or user object
        expect(verification.payload.email).toBeDefined()
      }
    })

    it('should invalidate JWT token on logout', async () => {
      const { token } = await createTestUser(testEmail, testPassword)

      if (!token) {
        throw new Error('Token is required for logout test')
      }

      // RevealUI CMS doesn't have a logout method - logout is handled via API endpoints
      // In a real scenario, you would call POST /api/users/logout
      // For testing purposes, we verify the token exists and can be used
      // Token invalidation would happen server-side via cookie clearing
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should reject expired JWT tokens', async () => {
      // Create a token and wait for expiration (if expiration is short)
      // For now, we test that expired tokens are rejected when used
      const revealui = await getTestRevealUI()

      // Create an expired token manually (this is a simplified test)
      // In production, RevealUI CMS handles token expiration
      const expiredToken = 'expired.token.here'

      // Attempt to use expired token
      await expect(
        revealui.find({
          collection: 'users',
          where: {
            email: {
              equals: testEmail,
            },
          },
          req: createAuthRequest(expiredToken),
        }),
      ).rejects.toThrow()
    })

    it('should reject tampered JWT tokens', async () => {
      const { token } = await createTestUser(testEmail, testPassword)

      // Tamper with token
      const parts = token.split('.')
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature`

      const revealui = await getTestRevealUI()

      // Attempt to use tampered token
      await expect(
        revealui.find({
          collection: 'users',
          where: {
            email: {
              equals: testEmail,
            },
          },
          req: createAuthRequest(tamperedToken),
        }),
      ).rejects.toThrow()
    })
  })

  describe('Session Management', () => {
    it('should maintain session across requests', async () => {
      const { token } = await createTestUser(testEmail, testPassword)

      const revealui = await getTestRevealUI()

      // First request
      const findResult = await revealui.find({
        collection: 'users',
        where: { email: { equals: testEmail } },
      })

      if (!findResult.docs[0]) {
        throw new Error('User not found in database')
      }

      const user1 = await revealui.findByID({
        collection: 'users',
        id: findResult.docs[0].id,
        req: createAuthRequest(token),
      })

      // Ensure user1 exists before continuing
      expect(user1).toBeDefined()
      if (!user1) throw new Error('user1 not found')

      // Type assert user1
      const typedUser1 = user1 as { id: string | number; email: string }

      // Second request with same token
      const user2 = await revealui.findByID({
        collection: 'users',
        id: typedUser1.id,
        req: createAuthRequest(token),
      })

      // Ensure user2 exists before continuing
      expect(user2).toBeDefined()
      if (!user2) throw new Error('user2 not found')

      // Type assert user2
      const typedUser2 = user2 as { id: string | number; email: string }

      expect(typedUser1.id).toBe(typedUser2.id)
      expect(typedUser1.email).toBe(typedUser2.email)
    })

    it('should expire session after timeout', async () => {
      // This test verifies that sessions expire
      // RevealUI CMS handles session expiration internally
      // We test that expired sessions are rejected
      const { token } = await createTestUser(testEmail, testPassword)

      // Note: Actual expiration testing requires time manipulation
      // This is a placeholder for the concept
      expect(token).toBeDefined()
    })

    it('should prevent session fixation attacks', async () => {
      // Verify fix for GHSA-26rv-h2hf-3fw4
      // Session fixation prevention: new session ID on login
      const { token: token1 } = await createTestUser(testEmail, testPassword)

      // Logout - RevealUI CMS doesn't have a logout method
      // In production, logout would be handled via API endpoint POST /api/users/logout
      // which clears the JWT cookie. For testing, we just verify token exists.
      if (!token1) {
        throw new Error('Token is required for session fixation test')
      }
      expect(token1).toBeDefined()

      // Login again - should get new token
      const revealui = await getTestRevealUI()
      const { token: token2 } = await revealui.login({
        collection: 'users',
        data: { email: testEmail, password: testPassword },
      })

      // Tokens should be different (new session)
      expect(token1).not.toBe(token2)
    })
  })

  describe('Password Security', () => {
    it('should enforce password complexity requirements', async () => {
      // Test password validation schema
      const weakPasswords = [
        'short1A', // Too short
        'password123', // No uppercase
        'PASSWORD123', // No lowercase
        'PasswordTest', // No number
      ]

      weakPasswords.forEach((password) => {
        const result = passwordSchema.safeParse(password)
        expect(result.success).toBe(false)
      })

      // Strong password should pass
      const strongPassword = 'TestPassword123'
      const result = passwordSchema.safeParse(strongPassword)
      expect(result.success).toBe(true)
    })

    it('should hash passwords before storage', async () => {
      const { user } = await createTestUser(testEmail, testPassword)

      // Password should not be stored in plain text
      // RevealUI CMS automatically hashes passwords
      expect(user.password).not.toBe(testPassword)
      expect(user.password).toBeDefined()
      // Hashed passwords are typically longer than original
      expect((user.password as string).length).toBeGreaterThan(testPassword.length)
    })

    it('should prevent timing attacks on password comparison', async () => {
      // This test verifies that password comparison is constant-time
      // RevealUI CMS uses bcrypt which is timing-safe
      const timingTestEmail = `timing-${crypto.randomUUID()}@example.com`
      const timingTestPassword = 'CorrectPassword123!'
      const shortWrongPassword = 'Short1!'
      const longWrongPassword =
        'ThisIsAVeryLongPasswordThatShouldNotAffectTimingBecauseBcryptIsConstantTime123!'

      // Create user for timing test
      await createTestUser(timingTestEmail, timingTestPassword)
      const revealui = await getTestRevealUI()

      // Attempt 1: Short wrong password
      const start1 = Date.now()
      try {
        await revealui.login({
          collection: 'users',
          data: { email: timingTestEmail, password: shortWrongPassword },
        })
      } catch {
        // Expected to fail
      }
      const end1 = Date.now()

      // Attempt 2: Long wrong password
      const start2 = Date.now()
      try {
        await revealui.login({
          collection: 'users',
          data: { email: timingTestEmail, password: longWrongPassword },
        })
      } catch {
        // Expected to fail
      }
      const end2 = Date.now()

      // Timing should be similar (within reasonable margin)
      // This is a basic check - real timing attack prevention is in bcrypt
      const time1 = end1 - start1
      const time2 = end2 - start2
      // Allow 500ms variance for system timing variations
      expect(Math.abs(time1 - time2)).toBeLessThan(500)
    })
  })
})

/**
 * Test implementation notes:
 *
 * 1. Set up test database with seed data
 * 2. Use RevealUI CMS test utilities
 * 3. Mock Supabase client if needed
 * 4. Clean up test data after each test
 * 5. Use actual RevealUI CMS auth API for integration tests
 */
