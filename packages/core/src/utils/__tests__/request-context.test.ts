/**
 * Request Context Tests
 *
 * Tests for request ID generation, context management, and propagation
 */

import { describe, expect, it } from 'vitest';
import {
  createRequestContext,
  extractRequestId,
  generateRequestId,
  getRequestContext,
  getRequestDuration,
  getRequestHeaders,
  getRequestId,
  type RequestContext,
  runInRequestContext,
  updateRequestContext,
} from '../request-context.js';

describe('generateRequestId', () => {
  it('should generate a valid UUID', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique IDs', () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
  });
});

describe('extractRequestId', () => {
  it('should extract request ID from x-request-id header', () => {
    const headers = { 'x-request-id': 'test-123' };
    expect(extractRequestId(headers)).toBe('test-123');
  });

  it('should extract request ID from x-correlation-id header', () => {
    const headers = { 'x-correlation-id': 'correlation-456' };
    expect(extractRequestId(headers)).toBe('correlation-456');
  });

  it('should extract request ID from x-trace-id header', () => {
    const headers = { 'x-trace-id': 'trace-789' };
    expect(extractRequestId(headers)).toBe('trace-789');
  });

  it('should extract request ID from request-id header', () => {
    const headers = { 'request-id': 'req-abc' };
    expect(extractRequestId(headers)).toBe('req-abc');
  });

  it('should prioritize x-request-id over other headers', () => {
    const headers = {
      'x-request-id': 'primary',
      'x-correlation-id': 'secondary',
    };
    expect(extractRequestId(headers)).toBe('primary');
  });

  it('should handle array header values', () => {
    const headers = { 'x-request-id': ['first', 'second'] };
    expect(extractRequestId(headers)).toBe('first');
  });

  it('should return undefined if no request ID headers present', () => {
    const headers = { authorization: 'Bearer token' };
    expect(extractRequestId(headers)).toBeUndefined();
  });
});

describe('runInRequestContext', () => {
  it('should run function within request context', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    const result = runInRequestContext(context, () => {
      const ctx = getRequestContext();
      expect(ctx).toBeDefined();
      expect(ctx?.requestId).toBe('test-123');
      return 'success';
    });

    expect(result).toBe('success');
  });

  it('should isolate context between nested calls', () => {
    const context1: RequestContext = {
      requestId: 'request-1',
      startTime: Date.now(),
    };

    const context2: RequestContext = {
      requestId: 'request-2',
      startTime: Date.now(),
    };

    runInRequestContext(context1, () => {
      expect(getRequestId()).toBe('request-1');

      runInRequestContext(context2, () => {
        expect(getRequestId()).toBe('request-2');
      });

      // Back to outer context
      expect(getRequestId()).toBe('request-1');
    });
  });

  it('should handle async functions', async () => {
    const context: RequestContext = {
      requestId: 'async-test',
      startTime: Date.now(),
    };

    const result = await runInRequestContext(context, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getRequestId()).toBe('async-test');
      return 'async-success';
    });

    expect(result).toBe('async-success');
  });

  it('should return undefined context outside of runInRequestContext', () => {
    expect(getRequestContext()).toBeUndefined();
    expect(getRequestId()).toBeUndefined();
  });
});

describe('getRequestContext', () => {
  it('should return undefined when not in context', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('should return context when in context', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
      userId: 'user-456',
      path: '/api/test',
    };

    runInRequestContext(context, () => {
      const ctx = getRequestContext();
      expect(ctx).toBeDefined();
      expect(ctx?.requestId).toBe('test-123');
      expect(ctx?.userId).toBe('user-456');
      expect(ctx?.path).toBe('/api/test');
    });
  });
});

describe('getRequestId', () => {
  it('should return undefined when not in context', () => {
    expect(getRequestId()).toBeUndefined();
  });

  it('should return request ID when in context', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    runInRequestContext(context, () => {
      expect(getRequestId()).toBe('test-123');
    });
  });
});

describe('updateRequestContext', () => {
  it('should update context with new data', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    runInRequestContext(context, () => {
      updateRequestContext({ userId: 'user-456' });

      const ctx = getRequestContext();
      expect(ctx?.userId).toBe('user-456');
      expect(ctx?.requestId).toBe('test-123'); // Original data preserved
    });
  });

  it('should do nothing when not in context', () => {
    // Should not throw
    updateRequestContext({ userId: 'user-456' });
    expect(getRequestContext()).toBeUndefined();
  });

  it('should allow updating multiple fields', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    runInRequestContext(context, () => {
      updateRequestContext({
        userId: 'user-456',
        path: '/api/users',
        method: 'GET',
      });

      const ctx = getRequestContext();
      expect(ctx?.userId).toBe('user-456');
      expect(ctx?.path).toBe('/api/users');
      expect(ctx?.method).toBe('GET');
    });
  });
});

describe('createRequestContext', () => {
  it('should create context with generated request ID', () => {
    const context = createRequestContext({
      path: '/api/test',
      method: 'GET',
    });

    expect(context.requestId).toBeDefined();
    expect(context.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(context.startTime).toBeGreaterThan(0);
    expect(context.path).toBe('/api/test');
    expect(context.method).toBe('GET');
  });

  it('should extract existing request ID from headers', () => {
    const context = createRequestContext({
      headers: { 'x-request-id': 'existing-123' },
      path: '/api/test',
    });

    expect(context.requestId).toBe('existing-123');
  });

  it('should extract user agent from headers', () => {
    const context = createRequestContext({
      headers: { 'user-agent': 'Mozilla/5.0' },
    });

    expect(context.userAgent).toBe('Mozilla/5.0');
  });

  it('should include IP address', () => {
    const context = createRequestContext({
      ip: '192.168.1.1',
    });

    expect(context.ip).toBe('192.168.1.1');
  });

  it('should include user ID', () => {
    const context = createRequestContext({
      userId: 'user-123',
    });

    expect(context.userId).toBe('user-123');
  });
});

describe('getRequestDuration', () => {
  it('should return undefined when not in context', () => {
    expect(getRequestDuration()).toBeUndefined();
  });

  it('should return duration in milliseconds', async () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    await runInRequestContext(context, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const duration = getRequestDuration();
      expect(duration).toBeGreaterThanOrEqual(45);
      expect(duration).toBeLessThan(200);
    });
  });

  it('should return 0 for immediate calls', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    runInRequestContext(context, () => {
      const duration = getRequestDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(10);
    });
  });
});

describe('getRequestHeaders', () => {
  it('should return empty object when not in context', () => {
    expect(getRequestHeaders()).toEqual({});
  });

  it('should return headers with request ID', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    runInRequestContext(context, () => {
      const headers = getRequestHeaders();
      expect(headers).toEqual({ 'x-request-id': 'test-123' });
    });
  });

  it('should be usable with fetch', () => {
    const context: RequestContext = {
      requestId: 'test-123',
      startTime: Date.now(),
    };

    runInRequestContext(context, () => {
      const headers = getRequestHeaders();

      // Simulate fetch call
      const fetchHeaders = {
        ...headers,
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      };

      expect(fetchHeaders).toEqual({
        'x-request-id': 'test-123',
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      });
    });
  });
});
