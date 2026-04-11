/**
 * MCP Adapter Lifecycle Tests
 *
 * Tests the adapter lifecycle management including:
 * - Initialization and configuration
 * - Request execution (success, error, timeout)
 * - Retry logic with backoff
 * - Action validation
 * - Concurrent request handling
 * - Resource cleanup on dispose
 * - Error handling edge cases
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPAdapter, type MCPConfig, type MCPRequest } from '../../mcp/adapter.js';

// =============================================================================
// Test Adapter Implementations
// =============================================================================

class BasicAdapter extends MCPAdapter {
  public executionCount = 0;

  constructor(config: MCPConfig = {}) {
    super('basic', config);
  }

  protected isValidAction(action: string): boolean {
    return ['echo', 'slow', 'fail', 'timeout-action'].includes(action);
  }

  protected getAuthHeaderName(): string {
    return 'X-API-Key';
  }

  protected async executeRequest(request: MCPRequest): Promise<unknown> {
    this.executionCount++;

    switch (request.action) {
      case 'echo':
        return { echo: request.parameters, executionCount: this.executionCount };

      case 'slow': {
        const delayMs = (request.parameters?.delayMs as number) ?? 50;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { result: 'slow-done', executionCount: this.executionCount };
      }

      case 'fail':
        throw new Error((request.parameters?.message as string) ?? 'Execution failed');

      case 'timeout-action':
        // Never resolves  -  simulates a hung request
        return new Promise(() => {});

      default:
        throw new Error(`Unhandled action: ${request.action}`);
    }
  }
}

/** Adapter that tracks failures and succeeds after N attempts */
class FlakeyAdapter extends MCPAdapter {
  public attempts = 0;
  private failUntilAttempt: number;

  constructor(failUntilAttempt: number, config: MCPConfig = {}) {
    super('flakey', config);
    this.failUntilAttempt = failUntilAttempt;
  }

  protected isValidAction(): boolean {
    return true;
  }

  protected getAuthHeaderName(): string {
    return 'Authorization';
  }

  protected async executeRequest(_request: MCPRequest): Promise<unknown> {
    this.attempts++;
    if (this.attempts < this.failUntilAttempt) {
      throw new Error(`Attempt ${this.attempts} failed`);
    }
    return { result: 'success', attempt: this.attempts };
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('MCP Adapter Lifecycle', () => {
  let adapter: BasicAdapter;

  beforeEach(() => {
    adapter = new BasicAdapter({ retryDelayMs: 10 }); // Fast retries for tests
  });

  afterEach(() => {
    adapter.dispose();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe('Initialization', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new BasicAdapter();
      try {
        expect(defaultAdapter.config.maxRetries).toBe(3);
        expect(defaultAdapter.config.retryDelayMs).toBe(1_000);
        expect(defaultAdapter.config.defaultIdempotencyTTLMs).toBe(300_000);
        expect(defaultAdapter.config.cleanupIntervalMs).toBe(60_000);
        expect(defaultAdapter.config.timeoutMs).toBe(30_000);
      } finally {
        defaultAdapter.dispose();
      }
    });

    it('should merge custom config with defaults', () => {
      const custom = new BasicAdapter({ maxRetries: 5, timeoutMs: 10_000 });
      try {
        expect(custom.config.maxRetries).toBe(5);
        expect(custom.config.timeoutMs).toBe(10_000);
        // Defaults preserved for unspecified values
        expect(custom.config.retryDelayMs).toBe(1_000);
      } finally {
        custom.dispose();
      }
    });

    it('should expose adapter name', () => {
      expect(adapter.name).toBe('basic');
    });

    it('should start with empty cache', () => {
      const stats = adapter.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Request Execution  -  Success
  // ---------------------------------------------------------------------------

  describe('Successful Execution', () => {
    it('should execute a simple request', async () => {
      const response = await adapter.execute({
        action: 'echo',
        parameters: { message: 'hello' },
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ echo: { message: 'hello' }, executionCount: 1 });
      expect(response.metadata?.adapter).toBe('basic');
      expect(response.metadata?.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.metadata?.cached).toBeUndefined();
      expect(response.metadata?.retries).toBeUndefined();
    });

    it('should increment execution count on each call', async () => {
      await adapter.execute({ action: 'echo' });
      await adapter.execute({ action: 'echo' });
      const response = await adapter.execute({ action: 'echo' });

      expect((response.data as { executionCount: number }).executionCount).toBe(3);
    });

    it('should handle requests with no parameters', async () => {
      const response = await adapter.execute({ action: 'echo' });

      expect(response.success).toBe(true);
      expect((response.data as { echo: undefined }).echo).toBeUndefined();
    });

    it('should handle slow requests within timeout', async () => {
      const response = await adapter.execute({
        action: 'slow',
        parameters: { delayMs: 20 },
        options: { timeout: 5_000 },
      });

      expect(response.success).toBe(true);
      expect((response.data as { result: string }).result).toBe('slow-done');
    });
  });

  // ---------------------------------------------------------------------------
  // Request Execution  -  Errors
  // ---------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should return error for invalid action', async () => {
      const response = await adapter.execute({ action: 'nonexistent' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid action: nonexistent');
      expect(response.metadata?.adapter).toBe('basic');
    });

    it('should return error after retries exhausted', async () => {
      const response = await adapter.execute({
        action: 'fail',
        parameters: { message: 'persistent failure' },
        options: { retries: 2 },
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('persistent failure');
      expect(response.metadata?.retries).toBe(2);
    });

    it('should not retry invalid action errors', async () => {
      const response = await adapter.execute({
        action: 'invalid-action',
        options: { retries: 5 },
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid action: invalid-action');
      // Invalid action is caught before retry loop
      expect(response.metadata?.retries).toBeUndefined();
      expect(adapter.executionCount).toBe(0);
    });

    it('should handle thrown non-Error objects', async () => {
      const throwAdapter = new (class extends BasicAdapter {
        protected async executeRequest(): Promise<unknown> {
          throw 'string error';
        }
      })({ retryDelayMs: 1 });

      try {
        const response = await throwAdapter.execute({
          action: 'echo',
          options: { retries: 1 },
        });

        expect(response.success).toBe(false);
        expect(response.error).toBe('string error');
      } finally {
        throwAdapter.dispose();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout Handling
  // ---------------------------------------------------------------------------

  describe('Timeout Handling', () => {
    it('should timeout hung requests', async () => {
      const response = await adapter.execute({
        action: 'timeout-action',
        options: { timeout: 50, retries: 1 },
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('timed out');
      expect(response.error).toContain('50ms');
    });

    it('should use per-request timeout over default', async () => {
      const response = await adapter.execute({
        action: 'timeout-action',
        options: { timeout: 30, retries: 1 },
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('30ms');
    });

    it('should use default timeout when not specified', async () => {
      const shortTimeoutAdapter = new BasicAdapter({
        timeoutMs: 25,
        maxRetries: 1,
        retryDelayMs: 1,
      });

      try {
        const response = await shortTimeoutAdapter.execute({ action: 'timeout-action' });
        expect(response.success).toBe(false);
        expect(response.error).toContain('25ms');
      } finally {
        shortTimeoutAdapter.dispose();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Retry Logic
  // ---------------------------------------------------------------------------

  describe('Retry Logic', () => {
    it('should retry and eventually succeed', async () => {
      const flakey = new FlakeyAdapter(3, { retryDelayMs: 5 });

      try {
        const response = await flakey.execute({
          action: 'anything',
          options: { retries: 5 },
        });

        expect(response.success).toBe(true);
        expect(flakey.attempts).toBe(3);
        expect(response.metadata?.retries).toBe(2);
      } finally {
        flakey.dispose();
      }
    });

    it('should fail when retries exhausted before success', async () => {
      const flakey = new FlakeyAdapter(10, { retryDelayMs: 1 });

      try {
        const response = await flakey.execute({
          action: 'anything',
          options: { retries: 3 },
        });

        expect(response.success).toBe(false);
        expect(flakey.attempts).toBe(3);
        expect(response.metadata?.retries).toBe(3);
      } finally {
        flakey.dispose();
      }
    });

    it('should use per-request retry count', async () => {
      const response = await adapter.execute({
        action: 'fail',
        options: { retries: 1 },
      });

      expect(response.success).toBe(false);
      expect(adapter.executionCount).toBe(1);
    });

    it('should apply linear backoff delay between retries', async () => {
      const start = Date.now();
      const flakey = new FlakeyAdapter(3, { retryDelayMs: 50 });

      try {
        await flakey.execute({
          action: 'anything',
          options: { retries: 3 },
        });

        const elapsed = Date.now() - start;
        // Delay: 50ms (attempt 1 fail) + 100ms (attempt 2 fail) = 150ms total delay
        expect(elapsed).toBeGreaterThanOrEqual(140);
      } finally {
        flakey.dispose();
      }
    });

    it('should not delay after the last retry attempt', async () => {
      const start = Date.now();
      const flakey = new FlakeyAdapter(999, { retryDelayMs: 100 });

      try {
        await flakey.execute({
          action: 'anything',
          options: { retries: 2 },
        });

        const elapsed = Date.now() - start;
        // Only 1 delay: 100ms (between attempt 1 and 2). No delay after attempt 2.
        expect(elapsed).toBeGreaterThanOrEqual(90);
        expect(elapsed).toBeLessThan(300);
      } finally {
        flakey.dispose();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Concurrent Requests
  // ---------------------------------------------------------------------------

  describe('Concurrent Requests', () => {
    it('should handle many concurrent requests without errors', async () => {
      const requests = Array.from({ length: 20 }, (_, i) => ({
        action: 'echo' as const,
        parameters: { id: i },
      }));

      const responses = await Promise.all(requests.map((r) => adapter.execute(r)));

      expect(responses).toHaveLength(20);
      responses.forEach((r) => {
        expect(r.success).toBe(true);
      });
    });

    it('should handle mixed success and failure concurrently', async () => {
      const requests: MCPRequest[] = [
        { action: 'echo', parameters: { id: 1 } },
        { action: 'fail', options: { retries: 1 } },
        { action: 'echo', parameters: { id: 2 } },
        { action: 'fail', options: { retries: 1 } },
        { action: 'echo', parameters: { id: 3 } },
      ];

      const responses = await Promise.all(requests.map((r) => adapter.execute(r)));

      expect(responses[0].success).toBe(true);
      expect(responses[1].success).toBe(false);
      expect(responses[2].success).toBe(true);
      expect(responses[3].success).toBe(false);
      expect(responses[4].success).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Resource Cleanup
  // ---------------------------------------------------------------------------

  describe('Resource Cleanup', () => {
    it('should clear cache on dispose', async () => {
      await adapter.execute({
        action: 'echo',
        options: { idempotencyKey: 'cleanup-test' },
      });

      expect(adapter.getCacheStats().size).toBe(1);

      adapter.dispose();

      expect(adapter.getCacheStats().size).toBe(0);
    });

    it('should stop cleanup interval on dispose', () => {
      const spy = vi.spyOn(global, 'clearInterval');
      adapter.dispose();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should allow multiple dispose calls without error', () => {
      expect(() => {
        adapter.dispose();
        adapter.dispose();
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Action Validation
  // ---------------------------------------------------------------------------

  describe('Action Validation', () => {
    it('should accept valid actions', async () => {
      const validActions = ['echo', 'slow', 'fail', 'timeout-action'];

      for (const action of validActions) {
        if (action === 'fail') {
          const response = await adapter.execute({ action, options: { retries: 1 } });
          expect(response.metadata?.adapter).toBe('basic');
        } else if (action === 'timeout-action') {
          const response = await adapter.execute({ action, options: { retries: 1, timeout: 10 } });
          expect(response.metadata?.adapter).toBe('basic');
        } else {
          const response = await adapter.execute({ action });
          expect(response.success).toBe(true);
        }
      }
    });

    it('should reject invalid actions without executing', async () => {
      const response = await adapter.execute({ action: 'delete-everything' });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid action');
      expect(adapter.executionCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  describe('Response Metadata', () => {
    it('should include adapter name in metadata', async () => {
      const response = await adapter.execute({ action: 'echo' });
      expect(response.metadata?.adapter).toBe('basic');
    });

    it('should include response time in metadata', async () => {
      const response = await adapter.execute({
        action: 'slow',
        parameters: { delayMs: 20 },
      });

      expect(response.metadata?.responseTimeMs).toBeGreaterThanOrEqual(15);
    });

    it('should include retry count only when retries occurred', async () => {
      // No retries needed
      const successResponse = await adapter.execute({ action: 'echo' });
      expect(successResponse.metadata?.retries).toBeUndefined();

      // Retries occurred
      const flakey = new FlakeyAdapter(2, { retryDelayMs: 1 });
      try {
        const retryResponse = await flakey.execute({ action: 'x', options: { retries: 3 } });
        expect(retryResponse.metadata?.retries).toBe(1);
      } finally {
        flakey.dispose();
      }
    });
  });
});
