/**
 * Test Helpers and Utilities
 *
 * Common utilities for testing across the project
 */

import type { RequestContext } from '../../utils/request-context.js';

/**
 * Wait for a condition to be true
 */
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {},
): Promise<T> {
  const { timeout = 5000, interval = 50, message = 'Condition not met within timeout' } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (_error) {
      // Continue waiting
    }

    await sleep(interval);
  }

  throw new Error(message);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock a Date to a fixed timestamp
 * Returns a cleanup function to restore original Date
 */
export function mockDate(date: Date | string | number): () => void {
  const timestamp = typeof date === 'number' ? date : new Date(date).getTime();
  const OriginalDate = global.Date;

  // Mock Date constructor
  global.Date = class extends OriginalDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(timestamp);
      } else {
        super(args[0] as number | string | Date);
      }
    }

    static now(): number {
      return timestamp;
    }
  } as typeof Date;

  // Return cleanup function
  return () => {
    global.Date = OriginalDate;
  };
}

/**
 * Create a mock request context for testing
 */
export function createMockContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    requestId: 'test-request-id',
    startTime: Date.now(),
    userId: undefined,
    ip: undefined,
    userAgent: undefined,
    path: undefined,
    method: undefined,
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a mock headers object
 */
export function createMockHeaders(headers: Record<string, string> = {}): Headers {
  const mockHeaders = new Headers();
  Object.entries(headers).forEach(([key, value]) => {
    mockHeaders.set(key, value);
  });
  return mockHeaders;
}

/**
 * Create a mock Next.js request
 */
export function createMockRequest(
  overrides: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    ip?: string;
  } = {},
): {
  url: string;
  method: string;
  headers: Headers;
  nextUrl: { pathname: string; searchParams: URLSearchParams; href: string };
  ip: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  formData: () => Promise<FormData>;
} {
  const {
    url = 'http://localhost:3000/api/test',
    method = 'GET',
    headers = {},
    body = null,
    ip = '127.0.0.1',
  } = overrides;

  const urlObj = new URL(url);

  return {
    url,
    method,
    headers: createMockHeaders(headers),
    nextUrl: {
      pathname: urlObj.pathname,
      searchParams: urlObj.searchParams,
      href: url,
    },
    ip,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    formData: async () => new FormData(),
  };
}

/**
 * Create a spy that tracks calls with timestamps
 */
export function createTimestampedSpy() {
  const calls: Array<{ args: unknown[]; timestamp: number }> = [];

  const spy = (...args: unknown[]) => {
    calls.push({
      args,
      timestamp: Date.now(),
    });
  };

  spy.calls = calls;
  spy.getCallCount = () => calls.length;
  spy.getLastCall = () => calls[calls.length - 1];
  spy.getFirstCall = () => calls[0];
  spy.reset = () => {
    calls.length = 0;
  };

  return spy;
}

/**
 * Mock console methods and capture output
 */
export function mockConsole(): {
  log: string[];
  error: string[];
  warn: string[];
  info: string[];
  restore: () => void;
} {
  const output = {
    log: [] as string[],
    error: [] as string[],
    warn: [] as string[],
    info: [] as string[],
  };

  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  console.log = (...args: unknown[]) => output.log.push(args.join(' '));
  console.error = (...args: unknown[]) => output.error.push(args.join(' '));
  console.warn = (...args: unknown[]) => output.warn.push(args.join(' '));
  console.info = (...args: unknown[]) => output.info.push(args.join(' '));

  return {
    ...output,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    },
  };
}

/**
 * Create a deferred promise for testing async flows
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Run a test with a timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  message = 'Test timed out',
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeout);
  });

  return Promise.race([fn(), timeoutPromise]);
}

/**
 * Retry a function until it succeeds or max attempts reached
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, delay = 100, backoff = false } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * attempt : delay;
        await sleep(waitTime);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Create a mock error for testing
 */
export function createMockError(
  message: string,
  options: {
    code?: string;
    statusCode?: number;
    cause?: Error;
    [key: string]: unknown;
  } = {},
): Error {
  const error = new Error(message) as Error & Record<string, unknown>;

  Object.entries(options).forEach(([key, value]) => {
    error[key] = value;
  });

  return error;
}

/**
 * Create a mock database error
 */
export function createMockDbError(
  pgCode: string,
  options: {
    constraint?: string;
    table?: string;
    column?: string;
    detail?: string;
  } = {},
): Error {
  const error = new Error('Database error') as Error & {
    code?: string;
    constraint?: string;
    table?: string;
    column?: string;
    detail?: string;
  };
  error.code = pgCode;
  error.constraint = options.constraint;
  error.table = options.table;
  error.column = options.column;
  error.detail = options.detail;

  return error;
}

/**
 * Assert that a value is defined (TypeScript type guard)
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message?: string,
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Create a range of numbers for testing iterations
 */
export function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Shuffle an array (for randomized testing)
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
