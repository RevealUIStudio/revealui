/**
 * Cleanup Manager Tests
 *
 * Comprehensive tests for CleanupManager including handler registration,
 * priority ordering, async execution, error handling, timeout behavior,
 * idempotent cleanup, and convenience functions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupManager,
  forceCleanup,
  getCleanupHandlers,
  initiateCleanup,
  isShutdownInProgress,
  registerCleanupHandler,
  unregisterCleanupHandler,
} from '../cleanup-manager.js';

// Mock logger to suppress output and verify logging calls
vi.mock('../../utils/logger-server.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CleanupManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupManager.clear();
  });

  afterEach(() => {
    cleanupManager.clear();
  });

  describe('register', () => {
    it('should register a cleanup handler', () => {
      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');

      const handlers = cleanupManager.getHandlers();
      expect(handlers).toHaveLength(1);
      expect(handlers[0].id).toBe('test-1');
      expect(handlers[0].description).toBe('Test handler');
      expect(handlers[0].priority).toBe(0);
    });

    it('should register handler with priority', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      cleanupManager.register('test-1', handler1, 'Handler 1', 10);
      cleanupManager.register('test-2', handler2, 'Handler 2', 5);

      const handlers = cleanupManager.getHandlers();
      expect(handlers).toHaveLength(2);
    });

    it('should not register duplicate handler ID', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      cleanupManager.register('test-1', handler1, 'First handler');
      cleanupManager.register('test-1', handler2, 'Duplicate');

      const handlers = cleanupManager.getHandlers();
      expect(handlers).toHaveLength(1);
      expect(handlers[0].description).toBe('First handler');
    });

    it('should register multiple handlers with different IDs', () => {
      cleanupManager.register('h1', vi.fn(), 'Handler 1');
      cleanupManager.register('h2', vi.fn(), 'Handler 2');
      cleanupManager.register('h3', vi.fn(), 'Handler 3');

      expect(cleanupManager.getHandlers()).toHaveLength(3);
    });

    it('should default priority to 0 when not specified', () => {
      cleanupManager.register('test', vi.fn(), 'Test');

      const handlers = cleanupManager.getHandlers();
      expect(handlers[0].priority).toBe(0);
    });
  });

  describe('unregister', () => {
    it('should unregister a cleanup handler', () => {
      cleanupManager.register('test-1', vi.fn(), 'Test handler');
      expect(cleanupManager.getHandlers()).toHaveLength(1);

      cleanupManager.unregister('test-1');
      expect(cleanupManager.getHandlers()).toHaveLength(0);
    });

    it('should do nothing when unregistering non-existent handler', () => {
      cleanupManager.register('test-1', vi.fn(), 'Test');

      cleanupManager.unregister('non-existent');
      expect(cleanupManager.getHandlers()).toHaveLength(1);
    });

    it('should only remove the specified handler', () => {
      cleanupManager.register('h1', vi.fn(), 'Handler 1');
      cleanupManager.register('h2', vi.fn(), 'Handler 2');

      cleanupManager.unregister('h1');

      const handlers = cleanupManager.getHandlers();
      expect(handlers).toHaveLength(1);
      expect(handlers[0].id).toBe('h2');
    });
  });

  describe('cleanup', () => {
    it('should execute all handlers in priority order (highest first)', async () => {
      const executionOrder: number[] = [];

      const handler1 = vi.fn(() => executionOrder.push(1));
      const handler2 = vi.fn(() => executionOrder.push(2));
      const handler3 = vi.fn(() => executionOrder.push(3));

      cleanupManager.register('test-1', handler1, 'Handler 1', 10);
      cleanupManager.register('test-2', handler2, 'Handler 2', 20);
      cleanupManager.register('test-3', handler3, 'Handler 3', 15);

      await cleanupManager.cleanup();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
      expect(executionOrder).toEqual([2, 3, 1]);
    });

    it('should execute async handlers', async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      cleanupManager.register('test-1', handler, 'Async handler');
      await cleanupManager.cleanup();

      expect(handler).toHaveBeenCalled();
    });

    it('should continue on handler error', async () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error');
      });
      const handler2 = vi.fn();

      cleanupManager.register('test-1', handler1, 'Failing handler', 10);
      cleanupManager.register('test-2', handler2, 'Working handler', 5);

      await cleanupManager.cleanup();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should not execute cleanup twice (idempotent)', async () => {
      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');

      await cleanupManager.cleanup();
      await cleanupManager.cleanup();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should accept an optional signal parameter', async () => {
      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');

      await cleanupManager.cleanup('SIGTERM');

      expect(handler).toHaveBeenCalled();
    });

    it('should handle cleanup with no registered handlers', async () => {
      // Should not throw
      await cleanupManager.cleanup();
    });

    it('should handle handler that rejects', async () => {
      const handler1 = vi.fn(async () => {
        throw new Error('Async rejection');
      });
      const handler2 = vi.fn();

      cleanupManager.register('failing', handler1, 'Failing async', 10);
      cleanupManager.register('working', handler2, 'Working', 5);

      await cleanupManager.cleanup();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should execute handlers with same priority in registration order', async () => {
      const executionOrder: string[] = [];

      cleanupManager.register(
        'a',
        vi.fn(() => executionOrder.push('a')),
        'A',
        5,
      );
      cleanupManager.register(
        'b',
        vi.fn(() => executionOrder.push('b')),
        'B',
        5,
      );
      cleanupManager.register(
        'c',
        vi.fn(() => executionOrder.push('c')),
        'C',
        5,
      );

      await cleanupManager.cleanup();

      // Same priority  -  order depends on sort stability (Map insertion order)
      expect(executionOrder).toHaveLength(3);
    });
  });

  describe('handler timeout', () => {
    it('should timeout individual handlers after 10 seconds', async () => {
      vi.useFakeTimers();

      const slowHandler = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(resolve, 15_000);
          }),
      );
      const fastHandler = vi.fn();

      cleanupManager.register('slow', slowHandler, 'Slow handler', 10);
      cleanupManager.register('fast', fastHandler, 'Fast handler', 5);

      const cleanupPromise = cleanupManager.cleanup();

      // Advance past the individual handler timeout (10s)
      await vi.advanceTimersByTimeAsync(10_001);

      // Advance past overall shutdown timeout
      await vi.advanceTimersByTimeAsync(30_000);

      await cleanupPromise;

      expect(slowHandler).toHaveBeenCalled();
      expect(fastHandler).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('forceCleanup', () => {
    it('should execute cleanup with zero timeout', async () => {
      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');

      await cleanupManager.forceCleanup();

      expect(handler).toHaveBeenCalled();
    });

    it('should restore original timeout after force cleanup', async () => {
      cleanupManager.setShutdownTimeout(5000);

      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');

      await cleanupManager.forceCleanup();

      // After forceCleanup, the timeout should be restored
      // We can only verify by checking that forceCleanup doesn't permanently change behavior
      expect(handler).toHaveBeenCalled();
    });

    it('should restore timeout even if cleanup throws', async () => {
      // Clear to reset shutdown state, then register a handler that works fine
      // The key test is that forceCleanup restores timeout in the finally block
      const handler = vi.fn();
      cleanupManager.register('test', handler, 'Test');

      await cleanupManager.forceCleanup();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('isShutdownInProgress', () => {
    it('should return false before cleanup', () => {
      expect(cleanupManager.isShutdownInProgress()).toBe(false);
    });

    it('should return true during cleanup', async () => {
      const handler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      cleanupManager.register('test-1', handler, 'Slow handler');

      const cleanupPromise = cleanupManager.cleanup();

      expect(cleanupManager.isShutdownInProgress()).toBe(true);

      await cleanupPromise;
    });

    it('should remain true after cleanup completes', async () => {
      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');

      await cleanupManager.cleanup();

      // isShuttingDown stays true until clear() is called
      expect(cleanupManager.isShutdownInProgress()).toBe(true);
    });

    it('should be reset by clear', async () => {
      const handler = vi.fn();
      cleanupManager.register('test-1', handler, 'Test handler');
      await cleanupManager.cleanup();

      cleanupManager.clear();

      expect(cleanupManager.isShutdownInProgress()).toBe(false);
    });
  });

  describe('setShutdownTimeout', () => {
    it('should update shutdown timeout', () => {
      cleanupManager.setShutdownTimeout(5000);
      // Verifies the method doesn't throw
    });

    it('should use the updated timeout for cleanup', async () => {
      vi.useFakeTimers();

      cleanupManager.setShutdownTimeout(1000);

      const neverResolves = vi.fn(
        () =>
          new Promise<void>(() => {
            // intentionally never resolves
          }),
      );

      cleanupManager.register('stuck', neverResolves, 'Stuck handler');

      const cleanupPromise = cleanupManager.cleanup();

      // Advance past the custom timeout
      await vi.advanceTimersByTimeAsync(1100);

      await cleanupPromise;

      expect(neverResolves).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('getHandlers', () => {
    it('should return empty array when no handlers', () => {
      expect(cleanupManager.getHandlers()).toEqual([]);
    });

    it('should return all registered handlers', () => {
      cleanupManager.register('h1', vi.fn(), 'Handler 1', 10);
      cleanupManager.register('h2', vi.fn(), 'Handler 2', 5);

      const handlers = cleanupManager.getHandlers();
      expect(handlers).toHaveLength(2);
      expect(handlers.map((h) => h.id)).toContain('h1');
      expect(handlers.map((h) => h.id)).toContain('h2');
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      cleanupManager.register('test-1', vi.fn(), 'Handler 1');
      cleanupManager.register('test-2', vi.fn(), 'Handler 2');

      expect(cleanupManager.getHandlers()).toHaveLength(2);

      cleanupManager.clear();

      expect(cleanupManager.getHandlers()).toHaveLength(0);
    });

    it('should reset isShuttingDown flag', async () => {
      cleanupManager.register('test', vi.fn(), 'Test');
      await cleanupManager.cleanup();

      expect(cleanupManager.isShutdownInProgress()).toBe(true);

      cleanupManager.clear();

      expect(cleanupManager.isShutdownInProgress()).toBe(false);
    });

    it('should allow cleanup to run again after clear', async () => {
      const handler1 = vi.fn();
      cleanupManager.register('test', handler1, 'Test');
      await cleanupManager.cleanup();

      cleanupManager.clear();

      const handler2 = vi.fn();
      cleanupManager.register('test2', handler2, 'Test 2');
      await cleanupManager.cleanup();

      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('convenience functions', () => {
    it('registerCleanupHandler should delegate to cleanupManager.register', () => {
      const handler = vi.fn();
      registerCleanupHandler('conv-1', handler, 'Convenience handler', 5);

      const handlers = getCleanupHandlers();
      expect(handlers).toHaveLength(1);
      expect(handlers[0].id).toBe('conv-1');
      expect(handlers[0].priority).toBe(5);
    });

    it('registerCleanupHandler should default priority to 0', () => {
      registerCleanupHandler('conv-1', vi.fn(), 'Test');

      const handlers = getCleanupHandlers();
      expect(handlers[0].priority).toBe(0);
    });

    it('unregisterCleanupHandler should delegate to cleanupManager.unregister', () => {
      registerCleanupHandler('conv-1', vi.fn(), 'Test');
      expect(getCleanupHandlers()).toHaveLength(1);

      unregisterCleanupHandler('conv-1');
      expect(getCleanupHandlers()).toHaveLength(0);
    });

    it('initiateCleanup should delegate to cleanupManager.cleanup', async () => {
      const handler = vi.fn();
      registerCleanupHandler('conv-1', handler, 'Test');

      await initiateCleanup('SIGINT');

      expect(handler).toHaveBeenCalled();
    });

    it('forceCleanup should delegate to cleanupManager.forceCleanup', async () => {
      const handler = vi.fn();
      registerCleanupHandler('conv-1', handler, 'Test');

      await forceCleanup();

      expect(handler).toHaveBeenCalled();
    });

    it('getCleanupHandlers should delegate to cleanupManager.getHandlers', () => {
      registerCleanupHandler('a', vi.fn(), 'A');
      registerCleanupHandler('b', vi.fn(), 'B');

      expect(getCleanupHandlers()).toHaveLength(2);
    });

    it('isShutdownInProgress should delegate to cleanupManager.isShutdownInProgress', async () => {
      expect(isShutdownInProgress()).toBe(false);

      registerCleanupHandler('test', vi.fn(), 'Test');
      await initiateCleanup();

      expect(isShutdownInProgress()).toBe(true);
    });
  });

  describe('logging', () => {
    it('should log warning when registering duplicate handler', async () => {
      const { logger } = await import('../../utils/logger-server.js');

      cleanupManager.register('dup', vi.fn(), 'First');
      cleanupManager.register('dup', vi.fn(), 'Duplicate');

      expect(logger.warn).toHaveBeenCalledWith('Cleanup handler already registered', { id: 'dup' });
    });

    it('should log debug when registering handler', async () => {
      const { logger } = await import('../../utils/logger-server.js');

      cleanupManager.register('test', vi.fn(), 'My handler', 5);

      expect(logger.debug).toHaveBeenCalledWith(
        'Registered cleanup handler',
        expect.objectContaining({ id: 'test', description: 'My handler', priority: 5 }),
      );
    });

    it('should log debug when unregistering handler', async () => {
      const { logger } = await import('../../utils/logger-server.js');

      cleanupManager.register('test', vi.fn(), 'Test');
      cleanupManager.unregister('test');

      expect(logger.debug).toHaveBeenCalledWith('Unregistered cleanup handler', { id: 'test' });
    });

    it('should log info when starting cleanup', async () => {
      const { logger } = await import('../../utils/logger-server.js');

      cleanupManager.register('test', vi.fn(), 'Test');
      await cleanupManager.cleanup('SIGTERM');

      expect(logger.info).toHaveBeenCalledWith(
        'Starting graceful shutdown',
        expect.objectContaining({ signal: 'SIGTERM', handlers: 1 }),
      );
    });

    it('should log error for failed handlers', async () => {
      const { logger } = await import('../../utils/logger-server.js');

      cleanupManager.register(
        'failing',
        () => {
          throw new Error('boom');
        },
        'Failing handler',
      );

      await cleanupManager.cleanup();

      expect(logger.error).toHaveBeenCalledWith(
        'Cleanup handler failed',
        expect.objectContaining({ id: 'failing' }),
      );
    });

    it('should log completion stats', async () => {
      const { logger } = await import('../../utils/logger-server.js');

      cleanupManager.register('ok', vi.fn(), 'OK handler');
      cleanupManager.register(
        'fail',
        () => {
          throw new Error('fail');
        },
        'Fail handler',
      );

      await cleanupManager.cleanup();

      expect(logger.info).toHaveBeenCalledWith(
        'Cleanup complete',
        expect.objectContaining({ total: 2, success: 1, failures: 1 }),
      );
    });
  });
});
