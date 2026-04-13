import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

/**
 * Tests for core-specific observability logger helpers.
 *
 * The base Logger class lives in @revealui/utils and is tested there.
 * These tests cover the helper functions exported from
 * packages/core/src/observability/logger.ts:
 *   - createRequestLogger
 *   - logPerformance
 *   - logAPICall
 *   - logCache
 *   - logUserAction
 *   - logSystemEvent
 *
 * Log redaction (formerly sanitizeLogData) now lives in @revealui/security;
 * those tests moved to packages/security/src/__tests__/sanitize.test.ts.
 */

// Use vi.hoisted so these variables are available inside the hoisted vi.mock factory.
const { mockChild, mockLogger } = vi.hoisted(() => {
  const mockChild = vi.fn();
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: mockChild,
  };
  return { mockChild, mockLogger };
});

vi.mock('@revealui/utils/logger', () => {
  const childInstance = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
  mockChild.mockReturnValue(childInstance);

  return {
    logger: mockLogger,
    Logger: class Logger {
      child = mockChild;
    },
    createLogger: vi.fn(),
    logError: vi.fn(),
    logAudit: vi.fn(),
    logQuery: vi.fn(),
  };
});

import {
  createRequestLogger,
  logAPICall,
  logCache,
  logPerformance,
  logSystemEvent,
  logUserAction,
} from '../logger.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Re-setup child return value after clearAllMocks
  const childInstance = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
  mockChild.mockReturnValue(childInstance);
});

// ---------------------------------------------------------------------------
// logPerformance
// ---------------------------------------------------------------------------
describe('logPerformance', () => {
  it('logs at info level for fast operations (<=1000ms)', () => {
    logPerformance('db-query', 500);
    expect(mockLogger.info).toHaveBeenCalledWith('Performance: db-query', {
      operation: 'db-query',
      duration: 500,
      slow: false,
    });
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('logs at warn level for slow operations (>1000ms)', () => {
    logPerformance('api-call', 1500);
    expect(mockLogger.warn).toHaveBeenCalledWith('Performance: api-call', {
      operation: 'api-call',
      duration: 1500,
      slow: true,
    });
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('treats exactly 1000ms as fast (not slow)', () => {
    logPerformance('boundary', 1000);
    expect(mockLogger.info).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('treats 1001ms as slow', () => {
    logPerformance('just-over', 1001);
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('includes additional context', () => {
    logPerformance('render', 200, { component: 'Header', cacheHit: true });
    expect(mockLogger.info).toHaveBeenCalledWith('Performance: render', {
      component: 'Header',
      cacheHit: true,
      operation: 'render',
      duration: 200,
      slow: false,
    });
  });

  it('handles zero duration', () => {
    logPerformance('instant', 0);
    expect(mockLogger.info).toHaveBeenCalledWith('Performance: instant', {
      operation: 'instant',
      duration: 0,
      slow: false,
    });
  });
});

// ---------------------------------------------------------------------------
// logAPICall
// ---------------------------------------------------------------------------
describe('logAPICall', () => {
  it('logs successful calls (2xx) at info level', () => {
    logAPICall('GET', '/api/users', 200, 150);
    expect(mockLogger.info).toHaveBeenCalledWith('API call', {
      method: 'GET',
      url: '/api/users',
      status: 200,
      duration: 150,
    });
  });

  it('logs redirects (3xx) at warn level', () => {
    logAPICall('GET', '/old-path', 301, 50);
    expect(mockLogger.warn).toHaveBeenCalledWith('API call', {
      method: 'GET',
      url: '/old-path',
      status: 301,
      duration: 50,
    });
  });

  it('logs client errors (4xx) at error level', () => {
    logAPICall('POST', '/api/auth', 401, 30);
    expect(mockLogger.error).toHaveBeenCalledWith('API call', undefined, {
      method: 'POST',
      url: '/api/auth',
      status: 401,
      duration: 30,
    });
  });

  it('logs server errors (5xx) at error level', () => {
    logAPICall('PUT', '/api/data', 500, 2000);
    expect(mockLogger.error).toHaveBeenCalledWith('API call', undefined, {
      method: 'PUT',
      url: '/api/data',
      status: 500,
      duration: 2000,
    });
  });

  it('includes additional context for all status ranges', () => {
    const ctx = { requestId: 'req-123' };

    logAPICall('DELETE', '/api/item/1', 204, 80, ctx);
    expect(mockLogger.info).toHaveBeenCalledWith('API call', {
      requestId: 'req-123',
      method: 'DELETE',
      url: '/api/item/1',
      status: 204,
      duration: 80,
    });
  });

  it('treats status 300 as a redirect (warn)', () => {
    logAPICall('GET', '/redirect', 300, 10);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('treats status 399 as a redirect (warn)', () => {
    logAPICall('GET', '/redirect', 399, 10);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('treats status 400 as an error', () => {
    logAPICall('GET', '/bad', 400, 10);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// logCache
// ---------------------------------------------------------------------------
describe('logCache', () => {
  it('logs cache hit', () => {
    logCache('hit', 'user:123');
    expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit', {
      operation: 'hit',
      key: 'user:123',
    });
  });

  it('logs cache miss', () => {
    logCache('miss', 'user:456');
    expect(mockLogger.debug).toHaveBeenCalledWith('Cache miss', {
      operation: 'miss',
      key: 'user:456',
    });
  });

  it('logs cache set', () => {
    logCache('set', 'session:abc');
    expect(mockLogger.debug).toHaveBeenCalledWith('Cache set', {
      operation: 'set',
      key: 'session:abc',
    });
  });

  it('logs cache delete', () => {
    logCache('delete', 'temp:xyz');
    expect(mockLogger.debug).toHaveBeenCalledWith('Cache delete', {
      operation: 'delete',
      key: 'temp:xyz',
    });
  });

  it('includes additional context', () => {
    logCache('hit', 'posts:list', { ttl: 300, size: 1024 });
    expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit', {
      ttl: 300,
      size: 1024,
      operation: 'hit',
      key: 'posts:list',
    });
  });
});

// ---------------------------------------------------------------------------
// logUserAction
// ---------------------------------------------------------------------------
describe('logUserAction', () => {
  it('logs action with userId', () => {
    logUserAction('login', 'user-42');
    expect(mockLogger.info).toHaveBeenCalledWith('User action', {
      action: 'login',
      userId: 'user-42',
    });
  });

  it('logs action without userId', () => {
    logUserAction('page_view');
    expect(mockLogger.info).toHaveBeenCalledWith('User action', {
      action: 'page_view',
      userId: undefined,
    });
  });

  it('includes additional context', () => {
    logUserAction('purchase', 'user-1', { productId: 'prod-99', amount: 49 });
    expect(mockLogger.info).toHaveBeenCalledWith('User action', {
      productId: 'prod-99',
      amount: 49,
      action: 'purchase',
      userId: 'user-1',
    });
  });
});

// ---------------------------------------------------------------------------
// logSystemEvent
// ---------------------------------------------------------------------------
describe('logSystemEvent', () => {
  it('logs a system event', () => {
    logSystemEvent('server_start');
    expect(mockLogger.info).toHaveBeenCalledWith('System event', {
      event: 'server_start',
    });
  });

  it('includes additional context', () => {
    logSystemEvent('cache_flush', { region: 'us-east-1', entries: 500 });
    expect(mockLogger.info).toHaveBeenCalledWith('System event', {
      region: 'us-east-1',
      entries: 500,
      event: 'cache_flush',
    });
  });

  it('logs without context', () => {
    logSystemEvent('shutdown');
    expect(mockLogger.info).toHaveBeenCalledWith('System event', {
      event: 'shutdown',
    });
  });
});

// ---------------------------------------------------------------------------
// createRequestLogger
// ---------------------------------------------------------------------------
describe('createRequestLogger', () => {
  let childLogger: {
    debug: MockInstance;
    info: MockInstance;
    warn: MockInstance;
    error: MockInstance;
    fatal: MockInstance;
  };

  beforeEach(() => {
    childLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
    };
    mockChild.mockReturnValue(childLogger);
  });

  function makeRequest(overrides: Record<string, unknown> = {}) {
    return {
      method: 'GET',
      url: '/api/test',
      headers: {
        get: (key: string) => {
          const map: Record<string, string> = {
            'user-agent': 'TestAgent/1.0',
          };
          return map[key] ?? null;
        },
        entries: () =>
          [
            ['user-agent', 'TestAgent/1.0'],
            ['accept', 'application/json'],
          ] as Iterable<[string, string]>,
      },
      ...overrides,
    };
  }

  it('logs request start and completion on success', async () => {
    const middleware = createRequestLogger();
    const request = makeRequest();
    const response = { status: 200, body: 'ok' };
    const next = vi.fn().mockResolvedValue(response);

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-1234',
    });

    const result = await middleware(request, next);

    expect(result).toBe(response);
    expect(next).toHaveBeenCalledOnce();

    // Should have created a child logger
    expect(mockChild).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'test-uuid-1234',
        method: 'GET',
        url: '/api/test',
        userAgent: 'TestAgent/1.0',
      }),
    );

    // Should log request start
    expect(childLogger.info).toHaveBeenCalledWith('Request started');

    // Should log request completion with status and duration
    expect(childLogger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({
        status: 200,
        duration: expect.any(Number),
      }),
    );

    vi.unstubAllGlobals();
  });

  it('logs error and re-throws on failure', async () => {
    const middleware = createRequestLogger();
    const request = makeRequest();
    const error = new Error('something broke');
    const next = vi.fn().mockRejectedValue(error);

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-5678',
    });

    await expect(middleware(request, next)).rejects.toThrow('something broke');

    expect(childLogger.error).toHaveBeenCalledWith(
      'Request failed',
      error,
      expect.objectContaining({ duration: expect.any(Number) }),
    );

    vi.unstubAllGlobals();
  });

  it('wraps non-Error throws in an Error', async () => {
    const middleware = createRequestLogger();
    const request = makeRequest();
    const next = vi.fn().mockRejectedValue('string error');

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-wrap',
    });

    await expect(middleware(request, next)).rejects.toBe('string error');

    expect(childLogger.error).toHaveBeenCalledWith(
      'Request failed',
      expect.any(Error),
      expect.objectContaining({ duration: expect.any(Number) }),
    );

    vi.unstubAllGlobals();
  });

  it('includes headers when includeHeaders option is true', async () => {
    const middleware = createRequestLogger({ includeHeaders: true });
    const request = makeRequest();
    const next = vi.fn().mockResolvedValue({ status: 200 });

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-hdrs',
    });

    await middleware(request, next);

    expect(childLogger.debug).toHaveBeenCalledWith('Request headers', {
      headers: {
        'user-agent': 'TestAgent/1.0',
        accept: 'application/json',
      },
    });

    vi.unstubAllGlobals();
  });

  it('does not include headers by default', async () => {
    const middleware = createRequestLogger();
    const request = makeRequest();
    const next = vi.fn().mockResolvedValue({ status: 200 });

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-nohdrs',
    });

    await middleware(request, next);

    expect(childLogger.debug).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('handles response without status property (defaults to 200)', async () => {
    const middleware = createRequestLogger();
    const request = makeRequest();
    const response = { body: 'no status' }; // no status field
    const next = vi.fn().mockResolvedValue(response);

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-nostatus',
    });

    await middleware(request, next);

    expect(childLogger.info).toHaveBeenCalledWith(
      'Request completed',
      expect.objectContaining({ status: 200 }),
    );

    vi.unstubAllGlobals();
  });

  it('handles request without headers', async () => {
    const middleware = createRequestLogger({ includeHeaders: true });
    const request = { method: 'POST', url: '/api/data' };
    const next = vi.fn().mockResolvedValue({ status: 201 });

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-noheaders',
    });

    await middleware(request, next);

    // Should not throw when headers are undefined
    expect(mockChild).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/data',
        userAgent: undefined,
      }),
    );

    // Headers debug log should still fire with empty object
    expect(childLogger.debug).toHaveBeenCalledWith('Request headers', {
      headers: {},
    });

    vi.unstubAllGlobals();
  });

  it('handles request where headers.get is undefined', async () => {
    const middleware = createRequestLogger();
    const request = {
      method: 'GET',
      url: '/test',
      headers: { entries: () => [] as Iterable<[string, string]> },
    };
    const next = vi.fn().mockResolvedValue({ status: 200 });

    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => 'test-uuid-noget',
    });

    await middleware(request, next);

    expect(mockChild).toHaveBeenCalledWith(expect.objectContaining({ userAgent: undefined }));

    vi.unstubAllGlobals();
  });
});
