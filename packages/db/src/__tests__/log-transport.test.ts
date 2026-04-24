import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock getClient so we never touch a real pool. The insert().values().catch()
// chain has to be promise-returning so the transport's fire-and-forget .catch()
// resolves cleanly.
const insertValues = vi.fn();
const insert = vi.fn(() => ({
  values: insertValues.mockImplementation(() => Promise.resolve()),
}));

vi.mock('../client/index.js', () => ({
  getClient: vi.fn(() => ({ insert })),
}));

vi.mock('../schema/app-logs.js', () => ({
  appLogs: { _symbol: 'appLogs' },
}));

import { createDbLogHandler } from '../log-transport.js';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  insertValues.mockClear();
  insert.mockClear();
});

afterEach(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

describe('createDbLogHandler', () => {
  it('returns a function that ignores info/debug levels', () => {
    process.env.NODE_ENV = 'production';
    const handler = createDbLogHandler('api');

    handler({ level: 'info', message: 'hi', timestamp: new Date() });
    handler({ level: 'debug', message: 'hi', timestamp: new Date() });

    expect(insert).not.toHaveBeenCalled();
  });

  it('ships warn/error/fatal only in production', () => {
    process.env.NODE_ENV = 'production';
    const handler = createDbLogHandler('api');

    handler({ level: 'warn', message: 'warn msg', timestamp: new Date() });
    handler({ level: 'error', message: 'err msg', timestamp: new Date() });
    handler({ level: 'fatal', message: 'fatal msg', timestamp: new Date() });

    expect(insert).toHaveBeenCalledTimes(3);
  });

  it('does NOT ship in development (NODE_ENV !== production)', () => {
    process.env.NODE_ENV = 'development';
    const handler = createDbLogHandler('api');

    handler({ level: 'error', message: 'ignored', timestamp: new Date() });
    handler({ level: 'fatal', message: 'ignored', timestamp: new Date() });

    expect(insert).not.toHaveBeenCalled();
  });

  it('does NOT ship in test env', () => {
    process.env.NODE_ENV = 'test';
    const handler = createDbLogHandler('api');

    handler({ level: 'error', message: 'ignored', timestamp: new Date() });

    expect(insert).not.toHaveBeenCalled();
  });

  it('passes app label + level + message into the inserted row', () => {
    process.env.NODE_ENV = 'production';
    const handler = createDbLogHandler('admin');

    handler({ level: 'warn', message: 'stuck', timestamp: new Date() });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: 'stuck',
        app: 'admin',
        environment: 'production',
      }),
    );
  });

  it('merges context + error into data', () => {
    process.env.NODE_ENV = 'production';
    const handler = createDbLogHandler('api');

    handler({
      level: 'error',
      message: 'boom',
      timestamp: new Date(),
      context: { requestId: 'req-1', userId: 'u-9', route: '/api/x' },
      error: new Error('kaboom'),
    });

    const lastValues = insertValues.mock.calls[0]?.[0] as {
      requestId: string | null;
      userId: string | null;
      data: Record<string, unknown> | null;
    };
    expect(lastValues.requestId).toBe('req-1');
    expect(lastValues.userId).toBe('u-9');
    expect(lastValues.data).toMatchObject({ requestId: 'req-1', userId: 'u-9', route: '/api/x' });
    expect(lastValues.data?.error).toBeInstanceOf(Error);
  });

  it('stores data as null when there is no context or error', () => {
    process.env.NODE_ENV = 'production';
    const handler = createDbLogHandler('api');

    handler({ level: 'warn', message: 'no-ctx', timestamp: new Date() });

    const lastValues = insertValues.mock.calls[0]?.[0] as {
      data: Record<string, unknown> | null;
      requestId: string | null;
      userId: string | null;
    };
    expect(lastValues.data).toBeNull();
    expect(lastValues.requestId).toBeNull();
    expect(lastValues.userId).toBeNull();
  });

  it('stores data as null when context is an empty object', () => {
    process.env.NODE_ENV = 'production';
    const handler = createDbLogHandler('api');

    handler({ level: 'warn', message: 'empty-ctx', timestamp: new Date(), context: {} });

    const lastValues = insertValues.mock.calls[0]?.[0] as { data: unknown };
    expect(lastValues.data).toBeNull();
  });

  it('swallows db insert failures silently (never throws to the caller)', async () => {
    process.env.NODE_ENV = 'production';
    insertValues.mockImplementation(() => Promise.reject(new Error('pool exhausted')));
    const handler = createDbLogHandler('api');

    // Must not throw.
    expect(() =>
      handler({ level: 'error', message: 'db down', timestamp: new Date() }),
    ).not.toThrow();

    // Give the fire-and-forget .catch() a tick to resolve.
    await new Promise((r) => setTimeout(r, 5));
  });
});
