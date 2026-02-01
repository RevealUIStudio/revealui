/**
 * Database Error Handling Tests
 *
 * Tests for Postgres error code parsing and database error handling
 */

import { describe, expect, it } from 'vitest'
import {
  DatabaseError,
  handleApiError,
  handleDatabaseError,
  PostgresErrorCode,
} from '../errors.js'

describe('DatabaseError', () => {
  it('should create a DatabaseError with all properties', () => {
    const error = new DatabaseError(
      'Duplicate email',
      'UNIQUE_VIOLATION',
      409,
      '23505',
      'users_email_unique',
      'users',
      'email',
      { operation: 'insert user' },
    )

    expect(error.name).toBe('DatabaseError')
    expect(error.message).toBe('Duplicate email')
    expect(error.code).toBe('UNIQUE_VIOLATION')
    expect(error.statusCode).toBe(409)
    expect(error.pgCode).toBe('23505')
    expect(error.constraint).toBe('users_email_unique')
    expect(error.table).toBe('users')
    expect(error.column).toBe('email')
    expect(error.context).toEqual({ operation: 'insert user' })
  })

  it('should capture stack trace', () => {
    const error = new DatabaseError('Test error', 'TEST_CODE', 500)
    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('DatabaseError')
  })
})

describe('handleDatabaseError', () => {
  describe('Unique Constraint Violations', () => {
    it('should handle unique constraint violation with pgCode', () => {
      const pgError = {
        code: PostgresErrorCode.UNIQUE_VIOLATION,
        constraint: 'users_email_unique',
        table: 'users',
        detail: 'Key (email)=(test@example.com) already exists.',
      }

      expect(() => {
        handleDatabaseError(pgError, 'insert user', { email: 'test@example.com' })
      }).toThrow(DatabaseError)

      try {
        handleDatabaseError(pgError, 'insert user', { email: 'test@example.com' })
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError)
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('UNIQUE_VIOLATION')
        expect(dbError.statusCode).toBe(409)
        expect(dbError.pgCode).toBe('23505')
        expect(dbError.constraint).toBe('users_email_unique')
        expect(dbError.message).toContain('Duplicate')
      }
    })

    it('should handle unique violation from error message (fallback)', () => {
      const error = new Error('duplicate key value violates unique constraint')

      expect(() => {
        handleDatabaseError(error, 'insert user')
      }).toThrow(DatabaseError)

      try {
        handleDatabaseError(error, 'insert user')
      } catch (err) {
        const dbError = err as DatabaseError
        expect(dbError.code).toBe('UNIQUE_VIOLATION')
        expect(dbError.statusCode).toBe(409)
      }
    })
  })

  describe('Foreign Key Violations', () => {
    it('should handle foreign key violation with pgCode', () => {
      const pgError = {
        code: PostgresErrorCode.FOREIGN_KEY_VIOLATION,
        constraint: 'posts_author_id_fkey',
        table: 'posts',
        detail: 'Key (author_id)=(999) is not present in table "users".',
      }

      expect(() => {
        handleDatabaseError(pgError, 'insert post', { authorId: 999 })
      }).toThrow(DatabaseError)

      try {
        handleDatabaseError(pgError, 'insert post', { authorId: 999 })
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('FOREIGN_KEY_VIOLATION')
        expect(dbError.statusCode).toBe(400)
        expect(dbError.pgCode).toBe('23503')
        expect(dbError.message).toContain('Invalid')
        expect(dbError.message).toContain('reference')
      }
    })

    it('should handle foreign key violation from error message (fallback)', () => {
      const error = new Error('violates foreign key constraint "posts_author_id_fkey"')

      try {
        handleDatabaseError(error, 'insert post')
      } catch (err) {
        const dbError = err as DatabaseError
        expect(dbError.code).toBe('FOREIGN_KEY_VIOLATION')
        expect(dbError.statusCode).toBe(400)
      }
    })
  })

  describe('Not Null Violations', () => {
    it('should handle not null violation with pgCode', () => {
      const pgError = {
        code: PostgresErrorCode.NOT_NULL_VIOLATION,
        column: 'email',
        table: 'users',
      }

      expect(() => {
        handleDatabaseError(pgError, 'insert user', { name: 'Test' })
      }).toThrow(DatabaseError)

      try {
        handleDatabaseError(pgError, 'insert user')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('NOT_NULL_VIOLATION')
        expect(dbError.statusCode).toBe(400)
        expect(dbError.column).toBe('email')
        expect(dbError.message).toContain('email')
        expect(dbError.message).toContain('cannot be null')
      }
    })
  })

  describe('Check Constraint Violations', () => {
    it('should handle check constraint violation', () => {
      const pgError = {
        code: PostgresErrorCode.CHECK_VIOLATION,
        constraint: 'users_age_check',
        table: 'users',
        detail: 'Failing row contains (age = -5).',
      }

      try {
        handleDatabaseError(pgError, 'insert user', { age: -5 })
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('CHECK_VIOLATION')
        expect(dbError.statusCode).toBe(400)
        expect(dbError.message).toContain('Validation failed')
      }
    })
  })

  describe('Concurrency Errors', () => {
    it('should handle deadlock detection', () => {
      const pgError = {
        code: PostgresErrorCode.DEADLOCK_DETECTED,
        table: 'orders',
      }

      try {
        handleDatabaseError(pgError, 'update order')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('DEADLOCK_DETECTED')
        expect(dbError.statusCode).toBe(409)
        expect(dbError.message).toContain('deadlock')
        expect(dbError.message).toContain('retry')
        expect(dbError.context?.retryable).toBe(true)
      }
    })

    it('should handle serialization failure', () => {
      const pgError = {
        code: PostgresErrorCode.SERIALIZATION_FAILURE,
      }

      try {
        handleDatabaseError(pgError, 'update account balance')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('SERIALIZATION_FAILURE')
        expect(dbError.statusCode).toBe(409)
        expect(dbError.message).toContain('Concurrent update')
        expect(dbError.context?.retryable).toBe(true)
      }
    })
  })

  describe('Timeout Errors', () => {
    it('should handle query timeout', () => {
      const pgError = {
        code: PostgresErrorCode.QUERY_CANCELED,
      }

      try {
        handleDatabaseError(pgError, 'complex analytics query')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('QUERY_TIMEOUT')
        expect(dbError.statusCode).toBe(504)
        expect(dbError.message).toContain('timeout')
      }
    })
  })

  describe('Connection Errors', () => {
    it('should handle connection failure', () => {
      const pgError = {
        code: PostgresErrorCode.CONNECTION_FAILURE,
      }

      try {
        handleDatabaseError(pgError, 'query users')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('CONNECTION_ERROR')
        expect(dbError.statusCode).toBe(503)
        expect(dbError.message).toContain('connection')
        expect(dbError.context?.retryable).toBe(true)
      }
    })
  })

  describe('Resource Errors', () => {
    it('should handle too many connections', () => {
      const pgError = {
        code: PostgresErrorCode.TOO_MANY_CONNECTIONS,
      }

      try {
        handleDatabaseError(pgError, 'create connection')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('RESOURCE_ERROR')
        expect(dbError.statusCode).toBe(503)
        expect(dbError.message).toContain('resource limit')
        expect(dbError.context?.retryable).toBe(true)
      }
    })

    it('should handle out of memory', () => {
      const pgError = {
        code: PostgresErrorCode.OUT_OF_MEMORY,
      }

      try {
        handleDatabaseError(pgError, 'large query')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('RESOURCE_ERROR')
        expect(dbError.statusCode).toBe(503)
      }
    })
  })

  describe('Schema Errors', () => {
    it('should handle undefined table', () => {
      const pgError = {
        code: PostgresErrorCode.UNDEFINED_TABLE,
        table: 'nonexistent_table',
      }

      try {
        handleDatabaseError(pgError, 'query table')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('SCHEMA_ERROR')
        expect(dbError.statusCode).toBe(500)
        expect(dbError.message).toContain('schema error')
      }
    })

    it('should handle undefined column', () => {
      const pgError = {
        code: PostgresErrorCode.UNDEFINED_COLUMN,
        column: 'nonexistent_column',
      }

      try {
        handleDatabaseError(pgError, 'query table')
      } catch (error) {
        const dbError = error as DatabaseError
        expect(dbError.code).toBe('SCHEMA_ERROR')
        expect(dbError.statusCode).toBe(500)
      }
    })
  })

  describe('Unknown Errors', () => {
    it('should handle unknown database error', () => {
      const error = new Error('Unknown database error')

      try {
        handleDatabaseError(error, 'some operation')
      } catch (err) {
        const dbError = err as DatabaseError
        expect(dbError.code).toBe('DATABASE_ERROR')
        expect(dbError.statusCode).toBe(500)
        expect(dbError.message).toBe('Database operation failed')
      }
    })

    it('should handle non-Error objects', () => {
      const error = { message: 'Something went wrong' }

      try {
        handleDatabaseError(error, 'some operation')
      } catch (err) {
        const dbError = err as DatabaseError
        expect(dbError.code).toBe('DATABASE_ERROR')
        expect(dbError.statusCode).toBe(500)
      }
    })
  })
})

describe('handleApiError with DatabaseError', () => {
  it('should handle DatabaseError in API routes', () => {
    const dbError = new DatabaseError(
      'Duplicate email',
      'UNIQUE_VIOLATION',
      409,
      '23505',
      'users_email_unique',
      'users',
      'email',
      { operation: 'insert user', retryable: false },
    )

    const result = handleApiError(dbError)

    expect(result.message).toBe('Duplicate email')
    expect(result.statusCode).toBe(409)
    expect(result.code).toBe('UNIQUE_VIOLATION')
    expect(result.retryable).toBe(false)
  })

  it('should include retryable flag for retryable errors', () => {
    const dbError = new DatabaseError(
      'Deadlock detected',
      'DEADLOCK_DETECTED',
      409,
      '40P01',
      undefined,
      'orders',
      undefined,
      { operation: 'update order', retryable: true },
    )

    const result = handleApiError(dbError)

    expect(result.retryable).toBe(true)
    expect(result.statusCode).toBe(409)
  })
})

describe('PostgresErrorCode constants', () => {
  it('should have correct error codes', () => {
    expect(PostgresErrorCode.UNIQUE_VIOLATION).toBe('23505')
    expect(PostgresErrorCode.FOREIGN_KEY_VIOLATION).toBe('23503')
    expect(PostgresErrorCode.NOT_NULL_VIOLATION).toBe('23502')
    expect(PostgresErrorCode.CHECK_VIOLATION).toBe('23514')
    expect(PostgresErrorCode.DEADLOCK_DETECTED).toBe('40P01')
    expect(PostgresErrorCode.SERIALIZATION_FAILURE).toBe('40001')
    expect(PostgresErrorCode.QUERY_CANCELED).toBe('57014')
    expect(PostgresErrorCode.TOO_MANY_CONNECTIONS).toBe('53300')
  })
})
