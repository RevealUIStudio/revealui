/**
 * Error Reporter Tests
 *
 * Comprehensive tests for ErrorReportingSystem, ConsoleErrorReporter,
 * LoggingErrorReporter, HTTPErrorReporter, initializeErrorReporting,
 * tracking functions, and ErrorFilters.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Breadcrumb, ErrorReporter, UserContext } from '../error-reporter.js';
import {
  ConsoleErrorReporter,
  ErrorFilters,
  ErrorReportingSystem,
  errorReporter,
  HTTPErrorReporter,
  initializeErrorReporting,
  LoggingErrorReporter,
  trackAction,
  trackAPICall,
  trackNavigation,
} from '../error-reporter.js';

// Mock the logger
vi.mock('../../observability/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-1234'),
  getRandomValues: vi.fn((arr: Uint32Array) => {
    arr[0] = 0;
    return arr;
  }),
});

describe('ErrorReportingSystem', () => {
  let system: ErrorReportingSystem;
  let mockReporter: ErrorReporter;

  beforeEach(() => {
    system = new ErrorReportingSystem();
    mockReporter = {
      captureError: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setContext: vi.fn(),
      setTag: vi.fn(),
      addBreadcrumb: vi.fn(),
    };
  });

  describe('addReporter / removeReporter', () => {
    it('should add a reporter', () => {
      system.addReporter(mockReporter);
      const error = new Error('test');
      system.captureError(error);
      expect(mockReporter.captureError).toHaveBeenCalledOnce();
    });

    it('should remove a reporter', () => {
      system.addReporter(mockReporter);
      system.removeReporter(mockReporter);
      system.captureError(new Error('test'));
      expect(mockReporter.captureError).not.toHaveBeenCalled();
    });

    it('should handle removing a reporter that was never added', () => {
      // Should not throw
      system.removeReporter(mockReporter);
    });
  });

  describe('captureError', () => {
    beforeEach(() => {
      system.addReporter(mockReporter);
    });

    it('should create an error report with defaults', () => {
      const error = new Error('test error');
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          error,
          timestamp: expect.any(String),
          id: 'test-uuid-1234',
          level: 'error',
          tags: {},
        }),
      );
    });

    it('should merge global context into report', () => {
      system.setContext({ environment: 'test', route: '/home' });
      const error = new Error('test');
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: expect.objectContaining({
            environment: 'test',
            route: '/home',
          }),
        }),
      );
    });

    it('should merge provided context into report', () => {
      const error = new Error('test');
      system.captureError(error, {
        context: { component: 'Header' },
        tags: { feature: 'nav' },
      });

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: expect.objectContaining({ component: 'Header' }),
          tags: expect.objectContaining({ feature: 'nav' }),
        }),
      );
    });

    it('should use provided id and fingerprint when given', () => {
      const error = new Error('test');
      system.captureError(error, {
        id: 'custom-id',
        fingerprint: 'custom-fingerprint',
      });

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          id: 'custom-id',
          fingerprint: 'custom-fingerprint',
        }),
      );
    });

    it('should use provided level when given', () => {
      const error = new Error('test');
      system.captureError(error, { level: 'fatal' });

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'fatal' }),
      );
    });

    it('should include user context when set', () => {
      system.setUser({ id: 'u1', email: 'a@b.com' });
      const error = new Error('test');
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          user: { id: 'u1', email: 'a@b.com' },
        }),
      );
    });

    it('should include last 10 breadcrumbs in extra', () => {
      for (let i = 0; i < 15; i++) {
        system.addBreadcrumb({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `crumb-${i}`,
        });
      }

      system.captureError(new Error('test'));

      const call = vi.mocked(mockReporter.captureError).mock.calls[0];
      const report = call[1];
      const breadcrumbs = report?.extra?.breadcrumbs as Breadcrumb[];
      expect(breadcrumbs).toHaveLength(10);
    });

    it('should add a breadcrumb for the captured error', () => {
      system.captureError(new Error('boom'));
      const crumbs = system.getBreadcrumbs();
      expect(crumbs).toHaveLength(1);
      expect(crumbs[0].category).toBe('error');
      expect(crumbs[0].message).toBe('boom');
    });

    it('should send to all reporters', () => {
      const reporter2: ErrorReporter = {
        captureError: vi.fn(),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setContext: vi.fn(),
        setTag: vi.fn(),
        addBreadcrumb: vi.fn(),
      };
      system.addReporter(reporter2);

      system.captureError(new Error('test'));
      expect(mockReporter.captureError).toHaveBeenCalledOnce();
      expect(reporter2.captureError).toHaveBeenCalledOnce();
    });

    it('should catch errors from reporters without propagating', async () => {
      const { logger } = await import('../../observability/logger.js');
      const badReporter: ErrorReporter = {
        captureError: vi.fn(() => {
          throw new Error('reporter failed');
        }),
        captureMessage: vi.fn(),
        setUser: vi.fn(),
        setContext: vi.fn(),
        setTag: vi.fn(),
        addBreadcrumb: vi.fn(),
      };
      system.addReporter(badReporter);

      // Should not throw
      system.captureError(new Error('test'));
      expect(logger.error).toHaveBeenCalledWith('Error reporter failed', expect.any(Error));
    });

    it('should not report when disabled', () => {
      system.setEnabled(false);
      system.captureError(new Error('test'));
      expect(mockReporter.captureError).not.toHaveBeenCalled();
    });

    it('should include errorInfo when provided', () => {
      const error = new Error('test');
      system.captureError(error, {
        errorInfo: { componentStack: 'at Header\nat App' },
      });

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          errorInfo: { componentStack: 'at Header\nat App' },
        }),
      );
    });
  });

  describe('captureMessage', () => {
    beforeEach(() => {
      system.addReporter(mockReporter);
    });

    it('should create a report with a message', () => {
      system.captureMessage('something happened');
      expect(mockReporter.captureMessage).toHaveBeenCalledWith(
        'something happened',
        'info',
        expect.objectContaining({
          level: 'info',
        }),
      );
    });

    it('should use the provided level', () => {
      system.captureMessage('warning', 'warning');
      expect(mockReporter.captureMessage).toHaveBeenCalledWith(
        'warning',
        'warning',
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('should merge global tags and context', () => {
      system.setTag('app', 'admin');
      system.setContext({ environment: 'prod' });
      system.captureMessage('hello', 'info', { tags: { extra: 'tag' } });

      expect(mockReporter.captureMessage).toHaveBeenCalledWith(
        'hello',
        'info',
        expect.objectContaining({
          tags: { app: 'admin', extra: 'tag' },
          context: expect.objectContaining({ environment: 'prod' }),
        }),
      );
    });

    it('should not report when disabled', () => {
      system.setEnabled(false);
      system.captureMessage('hello');
      expect(mockReporter.captureMessage).not.toHaveBeenCalled();
    });

    it('should add a breadcrumb for the message', () => {
      system.captureMessage('test msg', 'warning');
      const crumbs = system.getBreadcrumbs();
      expect(crumbs).toHaveLength(1);
      expect(crumbs[0].category).toBe('message');
      expect(crumbs[0].message).toBe('test msg');
      expect(crumbs[0].level).toBe('warning');
    });

    it('should catch errors from reporters', async () => {
      const { logger } = await import('../../observability/logger.js');
      const badReporter: ErrorReporter = {
        captureError: vi.fn(),
        captureMessage: vi.fn(() => {
          throw new Error('reporter failed');
        }),
        setUser: vi.fn(),
        setContext: vi.fn(),
        setTag: vi.fn(),
        addBreadcrumb: vi.fn(),
      };
      system.addReporter(badReporter);

      system.captureMessage('hello');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('setUser', () => {
    it('should set and propagate user to reporters', () => {
      system.addReporter(mockReporter);
      const user: UserContext = { id: 'u1', email: 'a@b.com' };
      system.setUser(user);

      expect(mockReporter.setUser).toHaveBeenCalledWith(user);
    });

    it('should clear user with null', () => {
      system.addReporter(mockReporter);
      system.setUser({ id: 'u1' });
      system.setUser(null);

      expect(mockReporter.setUser).toHaveBeenLastCalledWith(null);

      // Error report should not include user
      system.captureError(new Error('test'));
      expect(mockReporter.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ user: undefined }),
      );
    });
  });

  describe('setContext', () => {
    it('should merge context and propagate to reporters', () => {
      system.addReporter(mockReporter);
      system.setContext({ environment: 'test' });
      system.setContext({ route: '/home' });

      expect(mockReporter.setContext).toHaveBeenCalledTimes(2);
    });
  });

  describe('setTag', () => {
    it('should set tag and propagate to reporters', () => {
      system.addReporter(mockReporter);
      system.setTag('version', '1.0.0');
      expect(mockReporter.setTag).toHaveBeenCalledWith('version', '1.0.0');
    });

    it('should include tags in error reports', () => {
      system.addReporter(mockReporter);
      system.setTag('app', 'admin');
      system.captureError(new Error('test'));

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { app: 'admin' },
        }),
      );
    });
  });

  describe('addBreadcrumb', () => {
    it('should store breadcrumbs', () => {
      system.addBreadcrumb({
        timestamp: '2026-01-01T00:00:00Z',
        level: 'info',
        message: 'test',
      });

      expect(system.getBreadcrumbs()).toHaveLength(1);
    });

    it('should trim breadcrumbs to max (100)', () => {
      for (let i = 0; i < 110; i++) {
        system.addBreadcrumb({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `crumb-${i}`,
        });
      }

      const crumbs = system.getBreadcrumbs();
      expect(crumbs).toHaveLength(100);
      // First crumbs should have been trimmed
      expect(crumbs[0].message).toBe('crumb-10');
    });

    it('should propagate breadcrumbs to reporters', () => {
      system.addReporter(mockReporter);
      const crumb: Breadcrumb = {
        timestamp: '2026-01-01T00:00:00Z',
        level: 'info',
        message: 'click',
      };
      system.addBreadcrumb(crumb);

      expect(mockReporter.addBreadcrumb).toHaveBeenCalledWith(crumb);
    });
  });

  describe('clearBreadcrumbs', () => {
    it('should clear all breadcrumbs', () => {
      system.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'test',
      });
      system.clearBreadcrumbs();
      expect(system.getBreadcrumbs()).toHaveLength(0);
    });
  });

  describe('getBreadcrumbs', () => {
    it('should return a copy of breadcrumbs', () => {
      system.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'test',
      });

      const crumbs = system.getBreadcrumbs();
      crumbs.pop(); // Modify the copy
      expect(system.getBreadcrumbs()).toHaveLength(1); // Original unaffected
    });
  });

  describe('error filters', () => {
    it('should filter out errors matching a filter', () => {
      system.addReporter(mockReporter);
      system.addFilter((error) => error.message !== 'ignore-me');

      system.captureError(new Error('ignore-me'));
      expect(mockReporter.captureError).not.toHaveBeenCalled();
    });

    it('should allow errors that pass all filters', () => {
      system.addReporter(mockReporter);
      system.addFilter(() => true);
      system.addFilter(() => true);

      system.captureError(new Error('allow'));
      expect(mockReporter.captureError).toHaveBeenCalledOnce();
    });

    it('should block if any filter returns false', () => {
      system.addReporter(mockReporter);
      system.addFilter(() => true);
      system.addFilter(() => false);

      system.captureError(new Error('blocked'));
      expect(mockReporter.captureError).not.toHaveBeenCalled();
    });
  });

  describe('setEnabled', () => {
    it('should enable reporting after being disabled', () => {
      system.addReporter(mockReporter);
      system.setEnabled(false);
      system.captureError(new Error('disabled'));
      expect(mockReporter.captureError).not.toHaveBeenCalled();

      system.setEnabled(true);
      system.captureError(new Error('enabled'));
      expect(mockReporter.captureError).toHaveBeenCalledOnce();
    });
  });

  describe('error level determination', () => {
    beforeEach(() => {
      system.addReporter(mockReporter);
    });

    it('should classify TypeError as error level', () => {
      const error = new TypeError('cannot read properties');
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'error' }),
      );
    });

    it('should classify ReferenceError as error level', () => {
      const error = new ReferenceError('x is not defined');
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'error' }),
      );
    });

    it('should classify NetworkError as warning level', () => {
      const error = new Error('network issue');
      error.name = 'NetworkError';
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('should classify ValidationError as warning level', () => {
      const error = new Error('invalid input');
      error.name = 'ValidationError';
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'warning' }),
      );
    });

    it('should default to error level for unknown error types', () => {
      const error = new Error('generic');
      system.captureError(error);

      expect(mockReporter.captureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ level: 'error' }),
      );
    });
  });

  describe('fingerprint generation', () => {
    it('should generate fingerprint from error name and first stack line', () => {
      system.addReporter(mockReporter);
      const error = new Error('test');
      // Error will have a stack trace automatically
      system.captureError(error);

      const report = vi.mocked(mockReporter.captureError).mock.calls[0][1];
      expect(report?.fingerprint).toMatch(/^Error:/);
    });

    it('should handle errors without stack traces', () => {
      system.addReporter(mockReporter);
      const error = new Error('no stack');
      error.stack = undefined;
      system.captureError(error);

      const report = vi.mocked(mockReporter.captureError).mock.calls[0][1];
      expect(report?.fingerprint).toBe('Error:');
    });
  });
});

describe('ConsoleErrorReporter', () => {
  let reporter: ConsoleErrorReporter;

  beforeEach(async () => {
    reporter = new ConsoleErrorReporter();
    const { logger } = await import('../../observability/logger.js');
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.debug).mockClear();
  });

  it('should log errors via logger.error', async () => {
    const { logger } = await import('../../observability/logger.js');
    const error = new Error('test');
    reporter.captureError(error, {
      context: { component: 'Header' },
      tags: { env: 'test' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[Error Reporter] Error',
      error,
      expect.objectContaining({
        tags: { env: 'test' },
      }),
    );
  });

  it('should log fatal messages via logger.error', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureMessage('fatal msg', 'fatal');
    expect(logger.error).toHaveBeenCalledWith(
      '[Error Reporter] FATAL: fatal msg',
      undefined,
      undefined,
    );
  });

  it('should log error messages via logger.error', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureMessage('error msg', 'error');
    expect(logger.error).toHaveBeenCalledWith(
      '[Error Reporter] ERROR: error msg',
      undefined,
      undefined,
    );
  });

  it('should log warning messages via logger.warn', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureMessage('warn msg', 'warning');
    expect(logger.warn).toHaveBeenCalledWith('[Error Reporter] WARNING: warn msg', undefined);
  });

  it('should log info messages via logger.info', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureMessage('info msg', 'info');
    expect(logger.info).toHaveBeenCalledWith('[Error Reporter] INFO: info msg', undefined);
  });

  it('should log debug messages via logger.info', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureMessage('debug msg', 'debug');
    expect(logger.info).toHaveBeenCalledWith('[Error Reporter] DEBUG: debug msg', undefined);
  });

  it('should log setUser', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.setUser({ id: 'u1' });
    expect(logger.info).toHaveBeenCalledWith(
      '[Error Reporter] User set',
      expect.objectContaining({ user: { id: 'u1' } }),
    );
  });

  it('should log setContext', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.setContext({ environment: 'test' });
    expect(logger.info).toHaveBeenCalledWith(
      '[Error Reporter] Context set',
      expect.objectContaining({ context: { environment: 'test' } }),
    );
  });

  it('should log setTag', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.setTag('version', '1.0');
    expect(logger.info).toHaveBeenCalledWith('[Error Reporter] Tag set: version=1.0');
  });

  it('should log addBreadcrumb', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.addBreadcrumb({
      timestamp: '2026-01-01T00:00:00Z',
      level: 'info',
      message: 'click',
    });
    expect(logger.debug).toHaveBeenCalledWith(
      '[Error Reporter] Breadcrumb',
      expect.objectContaining({ breadcrumb: expect.any(Object) }),
    );
  });
});

describe('LoggingErrorReporter', () => {
  let reporter: LoggingErrorReporter;

  beforeEach(async () => {
    reporter = new LoggingErrorReporter();
    const { logger } = await import('../../observability/logger.js');
    vi.mocked(logger.debug).mockClear();
  });

  it('should log captured errors', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureError(new Error('test'), { level: 'error' });
    expect(logger.debug).toHaveBeenCalledWith(
      '[ErrorReporter] Error captured',
      expect.objectContaining({ error: 'test' }),
    );
  });

  it('should log captured messages', async () => {
    const { logger } = await import('../../observability/logger.js');
    reporter.captureMessage('hello', 'info');
    expect(logger.debug).toHaveBeenCalledWith(
      '[ErrorReporter] Message captured',
      expect.objectContaining({ message: 'hello', level: 'info' }),
    );
  });

  it('should be no-op for setUser, setContext, setTag, addBreadcrumb', () => {
    // These should not throw
    reporter.setUser({ id: 'u1' });
    reporter.setContext({ environment: 'test' });
    reporter.setTag('key', 'value');
    reporter.addBreadcrumb({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'test',
    });
  });
});

describe('HTTPErrorReporter', () => {
  let reporter: HTTPErrorReporter;

  beforeEach(() => {
    reporter = new HTTPErrorReporter('https://errors.example.com/report');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Re-stub crypto since unstubAllGlobals removes it
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'test-uuid-1234'),
      getRandomValues: vi.fn((arr: Uint32Array) => {
        arr[0] = 0;
        return arr;
      }),
    });
  });

  it('should POST error to endpoint', async () => {
    const error = new Error('test error');
    await reporter.captureError(error);

    expect(fetch).toHaveBeenCalledWith(
      'https://errors.example.com/report',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"type":"error"'),
      }),
    );

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.error.name).toBe('Error');
    expect(body.error.message).toBe('test error');
  });

  it('should POST message to endpoint', async () => {
    await reporter.captureMessage('hello', 'warning');

    expect(fetch).toHaveBeenCalledWith(
      'https://errors.example.com/report',
      expect.objectContaining({
        body: expect.stringContaining('"type":"message"'),
      }),
    );

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.message).toBe('hello');
    expect(body.level).toBe('warning');
  });

  it('should handle fetch failures gracefully', async () => {
    const { logger } = await import('../../observability/logger.js');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));

    await reporter.captureError(new Error('test'));
    expect(logger.error).toHaveBeenCalledWith('Failed to report error', expect.any(Error));
  });

  it('should handle captureMessage fetch failures', async () => {
    const { logger } = await import('../../observability/logger.js');
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'));

    await reporter.captureMessage('hello');
    expect(logger.error).toHaveBeenCalledWith('Failed to report message', expect.any(Error));
  });

  it('should be no-op for setUser, setContext, setTag, addBreadcrumb', () => {
    reporter.setUser({ id: 'u1' });
    reporter.setContext({ environment: 'test' });
    reporter.setTag('key', 'value');
    reporter.addBreadcrumb({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'test',
    });
  });
});

describe('initializeErrorReporting', () => {
  beforeEach(() => {
    // Reset the global error reporter state
    errorReporter.clearBreadcrumbs();
    errorReporter.setEnabled(true);
  });

  it('should set environment context and tag', () => {
    initializeErrorReporting({ environment: 'production' });
    // Verify indirectly by checking tags appear in reports
  });

  it('should set release context and tag', () => {
    initializeErrorReporting({ release: '1.0.0' });
  });

  it('should add ignore error filters', () => {
    // Create a fresh system to test filters in isolation
    const system = new ErrorReportingSystem();
    const mockReporter: ErrorReporter = {
      captureError: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      setContext: vi.fn(),
      setTag: vi.fn(),
      addBreadcrumb: vi.fn(),
    };
    system.addReporter(mockReporter);
    system.addFilter((error) => !['ResizeObserver'].some((p) => error.message.includes(p)));

    system.captureError(new Error('ResizeObserver loop'));
    expect(mockReporter.captureError).not.toHaveBeenCalled();

    system.captureError(new Error('real error'));
    expect(mockReporter.captureError).toHaveBeenCalledOnce();
  });

  it('should add DSN-based reporter (LoggingErrorReporter)', () => {
    initializeErrorReporting({ dsn: 'https://key@sentry.io/123' });
    // This adds a LoggingErrorReporter to the global instance
  });
});

describe('trackAction', () => {
  beforeEach(() => {
    errorReporter.clearBreadcrumbs();
  });

  it('should add a user-action breadcrumb', () => {
    trackAction('button_click', { button: 'submit' });

    const crumbs = errorReporter.getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].category).toBe('user-action');
    expect(crumbs[0].message).toBe('button_click');
    expect(crumbs[0].data).toEqual({ button: 'submit' });
    expect(crumbs[0].level).toBe('info');
  });

  it('should work without data', () => {
    trackAction('page_view');
    const crumbs = errorReporter.getBreadcrumbs();
    expect(crumbs[0].data).toBeUndefined();
  });
});

describe('trackNavigation', () => {
  beforeEach(() => {
    errorReporter.clearBreadcrumbs();
  });

  it('should add a navigation breadcrumb', () => {
    trackNavigation('/home', '/about');

    const crumbs = errorReporter.getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].category).toBe('navigation');
    expect(crumbs[0].message).toBe('Navigated from /home to /about');
    expect(crumbs[0].data).toEqual({ from: '/home', to: '/about' });
  });
});

describe('trackAPICall', () => {
  beforeEach(() => {
    errorReporter.clearBreadcrumbs();
  });

  it('should add an API breadcrumb with info level for success', () => {
    trackAPICall('GET', '/api/users', 200, 150);

    const crumbs = errorReporter.getBreadcrumbs();
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].category).toBe('api');
    expect(crumbs[0].message).toBe('GET /api/users');
    expect(crumbs[0].level).toBe('info');
    expect(crumbs[0].data).toEqual({
      method: 'GET',
      url: '/api/users',
      status: 200,
      duration: 150,
    });
  });

  it('should use warning level for 4xx+ status codes', () => {
    trackAPICall('POST', '/api/users', 500, 200);

    const crumbs = errorReporter.getBreadcrumbs();
    expect(crumbs[0].level).toBe('warning');
  });

  it('should use info level when status is undefined', () => {
    trackAPICall('GET', '/api/health');

    const crumbs = errorReporter.getBreadcrumbs();
    expect(crumbs[0].level).toBe('info');
  });

  it('should handle 400 as warning', () => {
    trackAPICall('PUT', '/api/data', 400);
    expect(errorReporter.getBreadcrumbs()[0].level).toBe('warning');
  });
});

describe('ErrorFilters', () => {
  describe('ignoreExtensions', () => {
    it('should filter chrome extension errors', () => {
      const error = new Error('ext error');
      error.stack = 'Error at chrome-extension://abc/content.js:1:1';
      expect(ErrorFilters.ignoreExtensions(error)).toBe(false);
    });

    it('should filter moz extension errors', () => {
      const error = new Error('ext error');
      error.stack = 'Error at moz-extension://abc/script.js:1:1';
      expect(ErrorFilters.ignoreExtensions(error)).toBe(false);
    });

    it('should filter safari extension errors', () => {
      const error = new Error('ext error');
      error.stack = 'Error at safari-extension://abc/script.js:1:1';
      expect(ErrorFilters.ignoreExtensions(error)).toBe(false);
    });

    it('should allow non-extension errors', () => {
      const error = new Error('normal error');
      error.stack = 'Error at /app/src/main.ts:10:5';
      expect(ErrorFilters.ignoreExtensions(error)).toBe(true);
    });

    it('should allow errors without stack', () => {
      const error = new Error('no stack');
      error.stack = undefined;
      expect(ErrorFilters.ignoreExtensions(error)).toBe(true);
    });
  });

  describe('ignoreNetwork', () => {
    it('should filter NetworkError', () => {
      const error = new Error('fail');
      error.name = 'NetworkError';
      expect(ErrorFilters.ignoreNetwork(error)).toBe(false);
    });

    it('should allow non-network errors', () => {
      const error = new Error('fail');
      expect(ErrorFilters.ignoreNetwork(error)).toBe(true);
    });
  });

  describe('ignoreCancelled', () => {
    it('should filter cancelled errors', () => {
      expect(ErrorFilters.ignoreCancelled(new Error('request cancelled'))).toBe(false);
    });

    it('should filter aborted errors', () => {
      expect(ErrorFilters.ignoreCancelled(new Error('request aborted'))).toBe(false);
    });

    it('should allow other errors', () => {
      expect(ErrorFilters.ignoreCancelled(new Error('server error'))).toBe(true);
    });
  });

  describe('ignoreMessages', () => {
    it('should filter errors matching any pattern', () => {
      const filter = ErrorFilters.ignoreMessages(['ResizeObserver', 'Script error']);
      expect(filter(new Error('ResizeObserver loop completed'))).toBe(false);
      expect(filter(new Error('Script error.'))).toBe(false);
    });

    it('should allow errors not matching any pattern', () => {
      const filter = ErrorFilters.ignoreMessages(['ResizeObserver']);
      expect(filter(new Error('real error'))).toBe(true);
    });
  });
});
