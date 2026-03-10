import { describe, expect, it, vi } from 'vitest'

vi.mock('../logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import {
  ApplicationError,
  DatabaseError,
  handleApiError,
  handleDatabaseError,
  PostgresErrorCode,
  ValidationError,
} from '../errors.js'

// ---------------------------------------------------------------------------
// Tests — Error Classes
// ---------------------------------------------------------------------------
describe('Error Classes', () => {
  describe('ApplicationError', () => {
    it('sets message, code, and statusCode', () => {
      const err = new ApplicationError('Not allowed', 'FORBIDDEN', 403)
      expect(err.message).toBe('Not allowed')
      expect(err.code).toBe('FORBIDDEN')
      expect(err.statusCode).toBe(403)
      expect(err.name).toBe('ApplicationError')
    })

    it('defaults statusCode to 500', () => {
      const err = new ApplicationError('Failed', 'INTERNAL')
      expect(err.statusCode).toBe(500)
    })

    it('accepts context', () => {
      const err = new ApplicationError('Err', 'CODE', 400, { userId: '1' })
      expect(err.context).toEqual({ userId: '1' })
    })
  })

  describe('ValidationError', () => {
    it('sets message, field, and value', () => {
      const err = new ValidationError('Invalid email', 'email', 'bad@')
      expect(err.message).toBe('Invalid email')
      expect(err.field).toBe('email')
      expect(err.value).toBe('bad@')
      expect(err.name).toBe('ValidationError')
    })
  })

  describe('DatabaseError', () => {
    it('sets all database error properties', () => {
      const err = new DatabaseError(
        'Dup',
        'UNIQUE',
        409,
        '23505',
        'users_email_unique',
        'users',
        'email',
      )
      expect(err.message).toBe('Dup')
      expect(err.code).toBe('UNIQUE')
      expect(err.statusCode).toBe(409)
      expect(err.pgCode).toBe('23505')
      expect(err.constraint).toBe('users_email_unique')
      expect(err.table).toBe('users')
      expect(err.column).toBe('email')
      expect(err.name).toBe('DatabaseError')
    })
  })
})

// ---------------------------------------------------------------------------
// Tests — handleApiError
// ---------------------------------------------------------------------------
describe('handleApiError', () => {
  it('handles DatabaseError', () => {
    const err = new DatabaseError('DB fail', 'DB_ERROR', 503)
    const result = handleApiError(err)

    expect(result.message).toBe('DB fail')
    expect(result.statusCode).toBe(503)
    expect(result.code).toBe('DB_ERROR')
  })

  it('handles ApplicationError', () => {
    const err = new ApplicationError('Forbidden', 'FORBIDDEN', 403)
    const result = handleApiError(err)

    expect(result.message).toBe('Forbidden')
    expect(result.statusCode).toBe(403)
  })

  it('handles ValidationError with 400 status', () => {
    const err = new ValidationError('Bad input', 'field', 'value')
    const result = handleApiError(err)

    expect(result.statusCode).toBe(400)
    expect(result.code).toBe('VALIDATION_ERROR')
  })

  it('handles unknown errors with generic message', () => {
    const result = handleApiError(new Error('something broke'))

    expect(result.message).toBe('An error occurred')
    expect(result.statusCode).toBe(500)
  })

  it('handles non-Error throws', () => {
    const result = handleApiError('string error')

    expect(result.message).toBe('An error occurred')
    expect(result.statusCode).toBe(500)
  })

  it('includes retryable flag from DatabaseError context', () => {
    const err = new DatabaseError(
      'Deadlock',
      'DEADLOCK',
      409,
      undefined,
      undefined,
      undefined,
      undefined,
      { retryable: true },
    )
    const result = handleApiError(err)

    expect(result.retryable).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests — handleDatabaseError
// ---------------------------------------------------------------------------
describe('handleDatabaseError', () => {
  it('throws DatabaseError for unique violation', () => {
    const pgError = {
      code: PostgresErrorCode.UNIQUE_VIOLATION,
      constraint: 'users_email_unique',
      table: 'users',
    }

    expect(() => handleDatabaseError(pgError, 'insert user')).toThrow(DatabaseError)
    try {
      handleDatabaseError(pgError, 'insert user')
    } catch (err) {
      const dbErr = err as DatabaseError
      expect(dbErr.code).toBe('UNIQUE_VIOLATION')
      expect(dbErr.statusCode).toBe(409)
    }
  })

  it('throws 400 for foreign key violation', () => {
    const pgError = { code: PostgresErrorCode.FOREIGN_KEY_VIOLATION }

    try {
      handleDatabaseError(pgError, 'insert')
    } catch (err) {
      expect((err as DatabaseError).statusCode).toBe(400)
      expect((err as DatabaseError).code).toBe('FOREIGN_KEY_VIOLATION')
    }
  })

  it('throws 400 for not null violation', () => {
    const pgError = { code: PostgresErrorCode.NOT_NULL_VIOLATION, column: 'email' }

    try {
      handleDatabaseError(pgError, 'insert')
    } catch (err) {
      expect((err as DatabaseError).message).toContain('email')
      expect((err as DatabaseError).statusCode).toBe(400)
    }
  })

  it('throws retryable for deadlock', () => {
    const pgError = { code: PostgresErrorCode.DEADLOCK_DETECTED }

    try {
      handleDatabaseError(pgError, 'update')
    } catch (err) {
      expect((err as DatabaseError).code).toBe('DEADLOCK_DETECTED')
      expect((err as DatabaseError).context?.retryable).toBe(true)
    }
  })

  it('throws 504 for query timeout', () => {
    const pgError = { code: PostgresErrorCode.QUERY_CANCELED }

    try {
      handleDatabaseError(pgError, 'query')
    } catch (err) {
      expect((err as DatabaseError).statusCode).toBe(504)
    }
  })

  it('throws 503 for connection errors', () => {
    for (const code of [
      PostgresErrorCode.CONNECTION_EXCEPTION,
      PostgresErrorCode.CONNECTION_FAILURE,
    ]) {
      try {
        handleDatabaseError({ code }, 'query')
      } catch (err) {
        expect((err as DatabaseError).statusCode).toBe(503)
        expect((err as DatabaseError).context?.retryable).toBe(true)
      }
    }
  })

  it('throws 503 for resource errors', () => {
    try {
      handleDatabaseError({ code: PostgresErrorCode.TOO_MANY_CONNECTIONS }, 'query')
    } catch (err) {
      expect((err as DatabaseError).statusCode).toBe(503)
    }
  })

  it('throws 500 for schema errors', () => {
    try {
      handleDatabaseError({ code: PostgresErrorCode.UNDEFINED_TABLE }, 'query')
    } catch (err) {
      expect((err as DatabaseError).code).toBe('SCHEMA_ERROR')
    }
  })

  it('detects unique violation from error message', () => {
    try {
      handleDatabaseError(new Error('duplicate key value violates unique constraint'), 'insert')
    } catch (err) {
      expect((err as DatabaseError).code).toBe('UNIQUE_VIOLATION')
      expect((err as DatabaseError).statusCode).toBe(409)
    }
  })

  it('detects not found from error message', () => {
    try {
      handleDatabaseError(new Error('record does not exist'), 'delete')
    } catch (err) {
      expect((err as DatabaseError).code).toBe('NOT_FOUND')
      expect((err as DatabaseError).statusCode).toBe(404)
    }
  })

  it('falls back to generic database error', () => {
    try {
      handleDatabaseError(new Error('some unknown issue'), 'update')
    } catch (err) {
      expect((err as DatabaseError).code).toBe('DATABASE_ERROR')
      expect((err as DatabaseError).statusCode).toBe(500)
    }
  })

  it('passes context to thrown error', () => {
    try {
      handleDatabaseError({ code: PostgresErrorCode.UNIQUE_VIOLATION }, 'insert', { userId: '1' })
    } catch (err) {
      expect((err as DatabaseError).context?.userId).toBe('1')
    }
  })
})
