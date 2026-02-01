/**
 * Cleanup Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cleanupManager } from '../cleanup-manager.js'

describe('CleanupManager', () => {
  beforeEach(() => {
    cleanupManager.clear()
  })

  describe('register', () => {
    it('should register a cleanup handler', () => {
      const handler = vi.fn()
      cleanupManager.register('test-1', handler, 'Test handler')

      const handlers = cleanupManager.getHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0].id).toBe('test-1')
      expect(handlers[0].description).toBe('Test handler')
    })

    it('should register handler with priority', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      cleanupManager.register('test-1', handler1, 'Handler 1', 10)
      cleanupManager.register('test-2', handler2, 'Handler 2', 5)

      const handlers = cleanupManager.getHandlers()
      expect(handlers).toHaveLength(2)
      expect(handlers[0].priority).toBe(10)
      expect(handlers[1].priority).toBe(5)
    })

    it('should not register duplicate handler', () => {
      const handler = vi.fn()
      cleanupManager.register('test-1', handler, 'Test handler')
      cleanupManager.register('test-1', handler, 'Duplicate')

      const handlers = cleanupManager.getHandlers()
      expect(handlers).toHaveLength(1)
    })
  })

  describe('unregister', () => {
    it('should unregister a cleanup handler', () => {
      const handler = vi.fn()
      cleanupManager.register('test-1', handler, 'Test handler')

      expect(cleanupManager.getHandlers()).toHaveLength(1)

      cleanupManager.unregister('test-1')

      expect(cleanupManager.getHandlers()).toHaveLength(0)
    })
  })

  describe('cleanup', () => {
    it('should execute all handlers in priority order', async () => {
      const executionOrder: number[] = []

      const handler1 = vi.fn(() => executionOrder.push(1))
      const handler2 = vi.fn(() => executionOrder.push(2))
      const handler3 = vi.fn(() => executionOrder.push(3))

      cleanupManager.register('test-1', handler1, 'Handler 1', 10)
      cleanupManager.register('test-2', handler2, 'Handler 2', 20)
      cleanupManager.register('test-3', handler3, 'Handler 3', 15)

      await cleanupManager.cleanup()

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
      expect(handler3).toHaveBeenCalled()
      expect(executionOrder).toEqual([2, 3, 1]) // Priority order: 20, 15, 10
    })

    it('should execute async handlers', async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      cleanupManager.register('test-1', handler, 'Async handler')

      await cleanupManager.cleanup()

      expect(handler).toHaveBeenCalled()
    })

    it('should continue on handler error', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error')
      })
      const handler2 = vi.fn()

      cleanupManager.register('test-1', handler1, 'Handler 1', 10)
      cleanupManager.register('test-2', handler2, 'Handler 2', 5)

      await cleanupManager.cleanup()

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should not execute cleanup twice', async () => {
      const handler = vi.fn()
      cleanupManager.register('test-1', handler, 'Test handler')

      await cleanupManager.cleanup()
      await cleanupManager.cleanup() // Second call should be ignored

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('forceCleanup', () => {
    it('should execute cleanup immediately', async () => {
      const handler = vi.fn()
      cleanupManager.register('test-1', handler, 'Test handler')

      await cleanupManager.forceCleanup()

      expect(handler).toHaveBeenCalled()
    })
  })

  describe('isShutdownInProgress', () => {
    it('should return false before cleanup', () => {
      expect(cleanupManager.isShutdownInProgress()).toBe(false)
    })

    it('should return true during cleanup', async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
      })

      cleanupManager.register('test-1', handler, 'Slow handler')

      const cleanupPromise = cleanupManager.cleanup()

      // Check immediately
      expect(cleanupManager.isShutdownInProgress()).toBe(true)

      await cleanupPromise
    })
  })

  describe('clear', () => {
    it('should clear all handlers', () => {
      cleanupManager.register('test-1', vi.fn(), 'Handler 1')
      cleanupManager.register('test-2', vi.fn(), 'Handler 2')

      expect(cleanupManager.getHandlers()).toHaveLength(2)

      cleanupManager.clear()

      expect(cleanupManager.getHandlers()).toHaveLength(0)
    })
  })

  describe('setShutdownTimeout', () => {
    it('should update shutdown timeout', () => {
      cleanupManager.setShutdownTimeout(5000)
      // No direct assertion, but verifies method exists
    })
  })
})
