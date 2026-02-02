/**
 * Test Helpers Tests
 *
 * Tests for the test utility functions
 */

import { describe, expect, it, vi } from 'vitest'
import {
  assertDefined,
  createDeferred,
  createMockContext,
  createMockDbError,
  createMockError,
  createMockHeaders,
  createMockRequest,
  createTimestampedSpy,
  mockConsole,
  mockDate,
  range,
  retry,
  shuffle,
  sleep,
  waitFor,
  withTimeout,
} from './test-helpers.js'

describe('Test Helpers', () => {
  describe('sleep', () => {
    it('should sleep for specified milliseconds', async () => {
      const start = Date.now()
      await sleep(50)
      const duration = Date.now() - start

      expect(duration).toBeGreaterThanOrEqual(45) // Account for timer precision
      expect(duration).toBeLessThan(100)
    })
  })

  describe('waitFor', () => {
    it('should wait for condition to be true', async () => {
      let value = false
      setTimeout(() => {
        value = true
      }, 50)

      const result = await waitFor(() => value, { interval: 10 })
      expect(result).toBe(true)
    })

    it('should timeout if condition never met', async () => {
      await expect(
        waitFor(() => false, { timeout: 100, message: 'Custom timeout' }),
      ).rejects.toThrow('Custom timeout')
    })

    it('should return result from function', async () => {
      const result = await waitFor(() => 'success', { timeout: 100 })
      expect(result).toBe('success')
    })
  })

  describe('mockDate', () => {
    it('should mock Date to fixed timestamp', () => {
      const fixedDate = new Date('2024-01-01T00:00:00Z')
      const restore = mockDate(fixedDate)

      expect(new Date().getTime()).toBe(fixedDate.getTime())
      expect(Date.now()).toBe(fixedDate.getTime())

      restore()

      // After restore, Date should work normally
      expect(new Date().getTime()).not.toBe(fixedDate.getTime())
    })

    it('should accept string date', () => {
      const restore = mockDate('2024-06-15')
      expect(new Date().toISOString()).toContain('2024-06-15')
      restore()
    })

    it('should accept timestamp', () => {
      const timestamp = 1704067200000 // 2024-01-01
      const restore = mockDate(timestamp)
      expect(Date.now()).toBe(timestamp)
      restore()
    })
  })

  describe('createMockContext', () => {
    it('should create context with defaults', () => {
      const context = createMockContext()

      expect(context).toHaveProperty('requestId')
      expect(context).toHaveProperty('startTime')
      expect(context.requestId).toBe('test-request-id')
    })

    it('should merge overrides', () => {
      const context = createMockContext({
        userId: 'user-123',
        path: '/api/test',
        method: 'POST',
      })

      expect(context.userId).toBe('user-123')
      expect(context.path).toBe('/api/test')
      expect(context.method).toBe('POST')
      expect(context.requestId).toBe('test-request-id')
    })
  })

  describe('createMockHeaders', () => {
    it('should create Headers object', () => {
      const headers = createMockHeaders({
        'content-type': 'application/json',
        authorization: 'Bearer token',
      })

      expect(headers.get('content-type')).toBe('application/json')
      expect(headers.get('authorization')).toBe('Bearer token')
    })

    it('should create empty headers', () => {
      const headers = createMockHeaders()
      expect(headers.get('content-type')).toBeNull()
    })
  })

  describe('createMockRequest', () => {
    it('should create request with defaults', () => {
      const request = createMockRequest()

      expect(request.method).toBe('GET')
      expect(request.url).toBe('http://localhost:3000/api/test')
      expect(request.ip).toBe('127.0.0.1')
      expect(request.nextUrl.pathname).toBe('/api/test')
    })

    it('should merge overrides', () => {
      const request = createMockRequest({
        url: 'http://example.com/api/users',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { name: 'Test' },
        ip: '192.168.1.1',
      })

      expect(request.method).toBe('POST')
      expect(request.nextUrl.pathname).toBe('/api/users')
      expect(request.headers.get('content-type')).toBe('application/json')
      expect(request.ip).toBe('192.168.1.1')
    })

    it('should handle async json method', async () => {
      const request = createMockRequest({ body: { test: 'data' } })
      const json = await request.json()
      expect(json).toEqual({ test: 'data' })
    })
  })

  describe('createTimestampedSpy', () => {
    it('should track calls with timestamps', () => {
      const spy = createTimestampedSpy()

      spy('arg1', 'arg2')
      spy('arg3')

      expect(spy.getCallCount()).toBe(2)
      expect(spy.getFirstCall()?.args).toEqual(['arg1', 'arg2'])
      expect(spy.getLastCall()?.args).toEqual(['arg3'])
    })

    it('should reset calls', () => {
      const spy = createTimestampedSpy()

      spy('arg1')
      spy('arg2')
      expect(spy.getCallCount()).toBe(2)

      spy.reset()
      expect(spy.getCallCount()).toBe(0)
    })
  })

  describe('mockConsole', () => {
    it('should capture console output', () => {
      const mock = mockConsole()

      console.log('log message')
      console.error('error message')
      console.warn('warn message')
      console.info('info message')

      expect(mock.log).toContain('log message')
      expect(mock.error).toContain('error message')
      expect(mock.warn).toContain('warn message')
      expect(mock.info).toContain('info message')

      mock.restore()
    })

    it('should restore original console', () => {
      const originalLog = console.log
      const mock = mockConsole()

      expect(console.log).not.toBe(originalLog)

      mock.restore()

      expect(console.log).toBe(originalLog)
    })
  })

  describe('createDeferred', () => {
    it('should create deferred promise', async () => {
      const deferred = createDeferred<string>()

      setTimeout(() => deferred.resolve('success'), 10)

      const result = await deferred.promise
      expect(result).toBe('success')
    })

    it('should handle rejection', async () => {
      const deferred = createDeferred<string>()

      setTimeout(() => deferred.reject(new Error('failed')), 10)

      await expect(deferred.promise).rejects.toThrow('failed')
    })
  })

  describe('withTimeout', () => {
    it('should complete before timeout', async () => {
      const result = await withTimeout(async () => 'success', 1000)
      expect(result).toBe('success')
    })

    it('should timeout if function takes too long', async () => {
      await expect(
        withTimeout(
          async () => {
            await sleep(200)
            return 'too slow'
          },
          50,
          'Custom timeout message',
        ),
      ).rejects.toThrow('Custom timeout message')
    })
  })

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await retry(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const result = await retry(fn, { maxAttempts: 3, delay: 10 })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'))

      await expect(retry(fn, { maxAttempts: 3, delay: 10 })).rejects.toThrow('always fails')

      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should use backoff delay', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')

      const start = Date.now()
      await retry(fn, { maxAttempts: 3, delay: 20, backoff: true })
      const duration = Date.now() - start

      // With backoff: 20ms + 40ms = 60ms
      expect(duration).toBeGreaterThanOrEqual(55)
    })
  })

  describe('createMockError', () => {
    it('should create error with message', () => {
      const error = createMockError('Test error')
      expect(error.message).toBe('Test error')
    })

    it('should add custom properties', () => {
      const error = createMockError('Test error', {
        code: 'ERR_TEST',
        statusCode: 500,
        custom: 'value',
      }) as any

      expect(error.code).toBe('ERR_TEST')
      expect(error.statusCode).toBe(500)
      expect(error.custom).toBe('value')
    })
  })

  describe('createMockDbError', () => {
    it('should create database error', () => {
      const error = createMockDbError('23505', {
        constraint: 'users_email_unique',
        table: 'users',
        column: 'email',
        detail: 'Key (email)=(test@example.com) already exists.',
      }) as any

      expect(error.code).toBe('23505')
      expect(error.constraint).toBe('users_email_unique')
      expect(error.table).toBe('users')
      expect(error.column).toBe('email')
    })
  })

  describe('assertDefined', () => {
    it('should pass for defined values', () => {
      expect(() => assertDefined('value')).not.toThrow()
      expect(() => assertDefined(0)).not.toThrow()
      expect(() => assertDefined(false)).not.toThrow()
    })

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow('Expected value to be defined')
    })

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow('Expected value to be defined')
    })

    it('should throw with custom message', () => {
      expect(() => assertDefined(undefined, 'Custom message')).toThrow('Custom message')
    })
  })

  describe('range', () => {
    it('should create range of numbers', () => {
      expect(range(1, 5)).toEqual([1, 2, 3, 4, 5])
      expect(range(0, 3)).toEqual([0, 1, 2, 3])
      expect(range(5, 5)).toEqual([5])
    })
  })

  describe('shuffle', () => {
    it('should shuffle array', () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = shuffle(original)

      // Should have same elements
      expect(shuffled.sort()).toEqual(original.sort())

      // Original should be unchanged
      expect(original).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle empty array', () => {
      expect(shuffle([])).toEqual([])
    })
  })
})
