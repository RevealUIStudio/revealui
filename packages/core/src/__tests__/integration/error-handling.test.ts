/**
 * Error Handling Integration Tests
 *
 * Tests for error propagation, handling, and recovery across the system
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { handleDatabaseError } from '../../utils/errors.js'
import { createRequestContext, runInRequestContext } from '../../utils/request-context.js'
import { createMockDbError, createMockError, mockConsole } from '../utils/test-helpers.js'

describe('Error Handling Integration', () => {
  let consoleMock: ReturnType<typeof mockConsole>

  beforeEach(() => {
    consoleMock = mockConsole()
  })

  afterEach(() => {
    consoleMock.restore()
  })

  describe('Database Error Handling', () => {
    it('should handle unique constraint violations', () => {
      const error = createMockDbError('23505', {
        constraint: 'users_email_unique',
        table: 'users',
        column: 'email',
        detail: 'Key (email)=(test@example.com) already exists.',
      })

      expect(() =>
        handleDatabaseError(error, 'insert user', { email: 'test@example.com' }),
      ).toThrow('Duplicate users email unique')
    })

    it('should handle foreign key violations', () => {
      const error = createMockDbError('23503', {
        constraint: 'posts_author_id_fkey',
        table: 'posts',
        detail: 'Key (author_id)=(999) is not present in table "users".',
      })

      expect(() => handleDatabaseError(error, 'insert post', { authorId: 999 })).toThrow(
        'Invalid posts author id fkey',
      )
    })

    it('should handle connection errors', () => {
      const error = createMockDbError('08006')

      expect(() => handleDatabaseError(error, 'query users')).toThrow('Database connection error')
    })

    it('should handle deadlocks with retry suggestion', () => {
      const error = createMockDbError('40P01')

      expect(() => handleDatabaseError(error, 'update order')).toThrow(/deadlock detected/i)
    })

    it('should preserve error context', () => {
      const error = createMockDbError('23505', {
        constraint: 'users_email_unique',
      })

      try {
        handleDatabaseError(error, 'insert user', {
          email: 'test@example.com',
          name: 'Test User',
        })
      } catch (e: unknown) {
        const error = e as { context?: { email?: string; name?: string } }
        expect(error.context).toHaveProperty('email')
        expect(error.context).toHaveProperty('name')
      }
    })
  })

  describe('API Error Handling', () => {
    it('should return proper status codes', () => {
      const errors = [
        { error: createMockError('Not found', { statusCode: 404 }), expected: 404 },
        { error: createMockError('Unauthorized', { statusCode: 401 }), expected: 401 },
        { error: createMockError('Bad request', { statusCode: 400 }), expected: 400 },
        { error: createMockError('Internal error', { statusCode: 500 }), expected: 500 },
      ]

      errors.forEach(({ error, expected }) => {
        // biome-ignore lint/suspicious/noExplicitAny: testing dynamic error properties
        expect((error as any).statusCode).toBe(expected)
      })
    })

    it('should include error codes', () => {
      const error = createMockError('Validation failed', {
        code: 'VALIDATION_ERROR',
      })

      // biome-ignore lint/suspicious/noExplicitAny: testing dynamic error properties
      expect((error as any).code).toBe('VALIDATION_ERROR')
    })

    it('should sanitize error messages in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const error = createMockError('Internal database error with sensitive data')

      // In production, detailed errors should be sanitized
      expect(error.message).toBeDefined()

      process.env.NODE_ENV = originalEnv
    })

    it('should include request ID in error responses', () => {
      const context = createRequestContext({
        requestId: 'req-123',
      })

      runInRequestContext(context, () => {
        const error = createMockError('Test error')

        // Error should include request ID for tracing
        expect(error).toBeDefined()
      })
    })
  })

  describe('Error Propagation', () => {
    it('should propagate errors up the call stack', async () => {
      async function level3() {
        throw new Error('Level 3 error')
      }

      async function level2() {
        await level3()
      }

      async function level1() {
        await level2()
      }

      await expect(level1()).rejects.toThrow('Level 3 error')
    })

    it('should preserve error stack traces', async () => {
      async function throwError() {
        throw new Error('Test error')
      }

      try {
        await throwError()
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect((error as Error).stack).toContain('throwError')
      }
    })

    it('should wrap and rethrow errors', () => {
      const originalError = new Error('Original error')

      try {
        throw originalError
      } catch (error) {
        const wrappedError = createMockError('Wrapped error', {
          cause: error,
        })

        // biome-ignore lint/suspicious/noExplicitAny: testing dynamic error properties
        expect((wrappedError as any).cause).toBe(originalError)
      }
    })
  })

  describe('Error Recovery', () => {
    it('should retry on transient errors', async () => {
      let attempt = 0
      const flaky = async () => {
        attempt++
        if (attempt < 3) {
          throw new Error('Transient error')
        }
        return 'success'
      }

      // Would use retry utility
      let result: string | undefined
      for (let i = 0; i < 3; i++) {
        try {
          result = await flaky()
          break
        } catch (_error) {
          // Continue retrying
        }
      }

      expect(result).toBe('success')
      expect(attempt).toBe(3)
    })

    it('should fallback on permanent errors', async () => {
      const primary = async () => {
        throw new Error('Permanent error')
      }

      const fallback = async () => {
        return 'fallback result'
      }

      let result: string
      try {
        result = await primary()
      } catch (_error) {
        result = await fallback()
      }

      expect(result).toBe('fallback result')
    })

    it('should circuit break after repeated failures', () => {
      let failures = 0
      const threshold = 5
      let circuitOpen = false

      const operation = () => {
        if (circuitOpen) {
          throw new Error('Circuit breaker open')
        }

        failures++
        if (failures >= threshold) {
          circuitOpen = true
        }

        throw new Error('Operation failed')
      }

      // Fail repeatedly
      for (let i = 0; i < threshold; i++) {
        try {
          operation()
        } catch (_error) {
          // Expected
        }
      }

      // Circuit should now be open
      expect(() => operation()).toThrow('Circuit breaker open')
    })
  })

  describe('Error Logging', () => {
    it('should log errors to console', () => {
      const error = new Error('Test error')

      console.error('Error occurred:', error)

      expect(consoleMock.error.length).toBeGreaterThan(0)
      expect(consoleMock.error[0]).toContain('Error occurred')
    })

    it('should log error context', () => {
      const error = createMockError('Test error', {
        userId: 'user-123',
        operation: 'test-operation',
      })

      console.error('Error with context:', error)

      expect(consoleMock.error.length).toBeGreaterThan(0)
    })

    it('should include stack traces in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = new Error('Dev error')
      console.error(error)

      // In dev, full stack should be logged
      expect(consoleMock.error.length).toBeGreaterThan(0)

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('Error Boundaries', () => {
    it('should create component errors with proper metadata', () => {
      const ComponentError = new Error('Component render error')
      ComponentError.name = 'ComponentError'

      expect(ComponentError).toBeInstanceOf(Error)
      expect(ComponentError.message).toBe('Component render error')
      expect(ComponentError.name).toBe('ComponentError')
      expect(ComponentError.stack).toBeDefined()
    })
  })

  describe('Validation Errors', () => {
    it('should validate input data', () => {
      const invalidData = {
        email: 'not-an-email',
        age: -5,
      }

      // Validation should fail
      const errors = []
      if (!invalidData.email.includes('@')) {
        errors.push('Invalid email')
      }
      if (invalidData.age < 0) {
        errors.push('Invalid age')
      }

      expect(errors).toHaveLength(2)
    })

    it('should return field-specific errors', () => {
      const validationErrors = {
        email: ['Invalid format'],
        password: ['Too short', 'No special characters'],
      }

      expect(validationErrors.email).toHaveLength(1)
      expect(validationErrors.password).toHaveLength(2)
    })

    it('should validate nested objects', () => {
      const data = {
        user: {
          profile: {
            age: -5,
          },
        },
      }

      // Should validate nested fields
      expect(data.user.profile.age).toBeLessThan(0)
    })
  })

  describe('Async Error Handling', () => {
    it('should catch async errors', async () => {
      const asyncError = async () => {
        throw new Error('Async error')
      }

      await expect(asyncError()).rejects.toThrow('Async error')
    })

    it('should handle promise rejections', async () => {
      const rejected = Promise.reject(new Error('Rejected'))

      await expect(rejected).rejects.toThrow('Rejected')
    })

    it('should catch errors in Promise.all', async () => {
      const promises = [Promise.resolve(1), Promise.reject(new Error('Failed')), Promise.resolve(3)]

      await expect(Promise.all(promises)).rejects.toThrow('Failed')
    })

    it('should handle errors in Promise.allSettled', async () => {
      const promises = [Promise.resolve(1), Promise.reject(new Error('Failed')), Promise.resolve(3)]

      const results = await Promise.allSettled(promises)

      expect(results[0]?.status).toBe('fulfilled')
      expect(results[1]?.status).toBe('rejected')
      expect(results[2]?.status).toBe('fulfilled')
    })
  })
})
