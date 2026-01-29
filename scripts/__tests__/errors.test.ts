/**
 * Tests for the typed error system
 */

import { describe, expect, it } from 'vitest'
import {
  ScriptError,
  ErrorCode,
  ErrorCodeDescriptions,
  notFound,
  validationError,
  configError,
  timeoutError,
  executionError,
  conflictError,
  permissionDenied,
  invalidState,
  isScriptError,
  getExitCode,
  wrapError,
  withErrorHandling,
} from '../lib/errors.js'

describe('ErrorCode', () => {
  it('has correct values', () => {
    expect(ErrorCode.SUCCESS).toBe(0)
    expect(ErrorCode.GENERAL_ERROR).toBe(1)
    expect(ErrorCode.CONFIG_ERROR).toBe(2)
    expect(ErrorCode.VALIDATION_ERROR).toBe(4)
    expect(ErrorCode.NOT_FOUND).toBe(6)
  })

  it('has descriptions for all codes', () => {
    const codes = Object.values(ErrorCode).filter(
      (v) => typeof v === 'number'
    ) as ErrorCode[]

    for (const code of codes) {
      expect(ErrorCodeDescriptions[code]).toBeDefined()
      expect(ErrorCodeDescriptions[code].length).toBeGreaterThan(0)
    }
  })
})

describe('ScriptError', () => {
  it('creates error with message and code', () => {
    const error = new ScriptError('Test error', ErrorCode.VALIDATION_ERROR)

    expect(error.message).toBe('Test error')
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(error.name).toBe('ScriptError')
  })

  it('includes details', () => {
    const error = new ScriptError('Test', ErrorCode.NOT_FOUND, {
      resourceId: '123',
      resourceType: 'workflow',
    })

    expect(error.details).toEqual({
      resourceId: '123',
      resourceType: 'workflow',
    })
  })

  it('defaults to GENERAL_ERROR', () => {
    const error = new ScriptError('Test')
    expect(error.code).toBe(ErrorCode.GENERAL_ERROR)
  })

  it('provides codeString', () => {
    const error = new ScriptError('Test', ErrorCode.NOT_FOUND)
    expect(error.codeString).toBe('NOT_FOUND')
  })

  it('converts to JSON', () => {
    const error = new ScriptError('Test', ErrorCode.VALIDATION_ERROR, {
      field: 'name',
    })

    const json = error.toJSON()

    expect(json).toEqual({
      code: 'VALIDATION_ERROR',
      exitCode: 4,
      message: 'Test',
      details: { field: 'name' },
    })
  })

  it('gets code description', () => {
    const error = new ScriptError('Test', ErrorCode.NOT_FOUND)
    expect(error.getCodeDescription()).toBe('Resource not found')
  })
})

describe('error factory functions', () => {
  describe('notFound', () => {
    it('creates not found error', () => {
      const error = notFound('Workflow', 'wf-123')

      expect(error.message).toBe('Workflow not found: wf-123')
      expect(error.code).toBe(ErrorCode.NOT_FOUND)
      expect(error.details).toEqual({ resource: 'Workflow', id: 'wf-123' })
    })

    it('works without id', () => {
      const error = notFound('Configuration')
      expect(error.message).toBe('Configuration not found')
    })
  })

  describe('validationError', () => {
    it('creates validation error', () => {
      const error = validationError('Invalid email format', 'email')

      expect(error.message).toBe('Invalid email format')
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(error.details?.field).toBe('email')
    })
  })

  describe('configError', () => {
    it('creates config error', () => {
      const error = configError('Missing environment variable', 'API_KEY')

      expect(error.message).toBe('Missing environment variable')
      expect(error.code).toBe(ErrorCode.CONFIG_ERROR)
      expect(error.details?.envVar).toBe('API_KEY')
    })
  })

  describe('timeoutError', () => {
    it('creates timeout error', () => {
      const error = timeoutError('Database connection', 5000)

      expect(error.message).toBe('Database connection timed out after 5000ms')
      expect(error.code).toBe(ErrorCode.TIMEOUT_ERROR)
      expect(error.details).toEqual({
        operation: 'Database connection',
        timeoutMs: 5000,
      })
    })
  })

  describe('executionError', () => {
    it('creates execution error with exit code', () => {
      const error = executionError('pnpm build', 1, 'Build failed')

      expect(error.message).toBe('Command failed with exit code 1: pnpm build')
      expect(error.code).toBe(ErrorCode.EXECUTION_ERROR)
      expect(error.details?.command).toBe('pnpm build')
      expect(error.details?.exitCode).toBe(1)
      expect(error.details?.stderr).toBe('Build failed')
    })

    it('works without exit code', () => {
      const error = executionError('pnpm build')
      expect(error.message).toBe('Command failed: pnpm build')
    })
  })

  describe('conflictError', () => {
    it('creates conflict error', () => {
      const error = conflictError('Workflow', 'Already running')

      expect(error.message).toBe('Conflict: Workflow - Already running')
      expect(error.code).toBe(ErrorCode.CONFLICT)
    })
  })

  describe('permissionDenied', () => {
    it('creates permission denied error', () => {
      const error = permissionDenied('delete', 'admin resource')

      expect(error.message).toBe('Permission denied: delete on admin resource')
      expect(error.code).toBe(ErrorCode.PERMISSION_DENIED)
    })
  })

  describe('invalidState', () => {
    it('creates invalid state error', () => {
      const error = invalidState('start', 'completed', ['pending', 'paused'])

      expect(error.message).toBe(
        "Cannot start in state 'completed'. Expected one of: pending, paused"
      )
      expect(error.code).toBe(ErrorCode.INVALID_STATE)
    })
  })
})

describe('isScriptError', () => {
  it('returns true for ScriptError', () => {
    const error = new ScriptError('Test')
    expect(isScriptError(error)).toBe(true)
  })

  it('returns false for regular Error', () => {
    const error = new Error('Test')
    expect(isScriptError(error)).toBe(false)
  })

  it('returns false for non-errors', () => {
    expect(isScriptError('string')).toBe(false)
    expect(isScriptError(null)).toBe(false)
    expect(isScriptError(undefined)).toBe(false)
  })
})

describe('getExitCode', () => {
  it('returns code from ScriptError', () => {
    const error = new ScriptError('Test', ErrorCode.NOT_FOUND)
    expect(getExitCode(error)).toBe(ErrorCode.NOT_FOUND)
  })

  it('returns GENERAL_ERROR for other errors', () => {
    expect(getExitCode(new Error('Test'))).toBe(ErrorCode.GENERAL_ERROR)
    expect(getExitCode('string error')).toBe(ErrorCode.GENERAL_ERROR)
  })
})

describe('wrapError', () => {
  it('returns ScriptError unchanged', () => {
    const original = new ScriptError('Test', ErrorCode.NOT_FOUND)
    const wrapped = wrapError(original)

    expect(wrapped).toBe(original)
  })

  it('wraps regular Error', () => {
    const original = new Error('Test error')
    const wrapped = wrapError(original, ErrorCode.EXECUTION_ERROR)

    expect(wrapped).toBeInstanceOf(ScriptError)
    expect(wrapped.message).toBe('Test error')
    expect(wrapped.code).toBe(ErrorCode.EXECUTION_ERROR)
    expect(wrapped.details?.originalName).toBe('Error')
  })

  it('wraps string error', () => {
    const wrapped = wrapError('string error')

    expect(wrapped).toBeInstanceOf(ScriptError)
    expect(wrapped.message).toBe('string error')
  })
})

describe('withErrorHandling', () => {
  it('returns result on success', async () => {
    const result = await withErrorHandling(async () => 'success')
    expect(result).toBe('success')
  })

  it('wraps thrown errors', async () => {
    await expect(
      withErrorHandling(async () => {
        throw new Error('Test')
      }, ErrorCode.EXECUTION_ERROR)
    ).rejects.toThrow(ScriptError)
  })

  it('preserves ScriptError code', async () => {
    const originalError = new ScriptError('Original', ErrorCode.NOT_FOUND)

    try {
      await withErrorHandling(async () => {
        throw originalError
      }, ErrorCode.EXECUTION_ERROR)
    } catch (error) {
      expect(isScriptError(error)).toBe(true)
      expect((error as ScriptError).code).toBe(ErrorCode.NOT_FOUND)
    }
  })
})
