/**
 * Regression tests for the pool `onPoolConnect` SET-statement bug (GAP-349
 * fleet scan incident): `SET statement_timeout TO $1` fails on every pool
 * connection with "syntax error at or near $1" because Postgres' `SET`
 * command does not accept bind parameters. The fix validates the timeout
 * value and interpolates it as a literal instead.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPoolInstance = {
  on: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
  query: vi.fn(),
  totalCount: 10,
  idleCount: 5,
  waitingCount: 0,
};

vi.mock('pg', () => {
  class MockPool {
    on = mockPoolInstance.on;
    connect = mockPoolInstance.connect;
    end = mockPoolInstance.end;
    query = mockPoolInstance.query;
    totalCount = mockPoolInstance.totalCount;
    idleCount = mockPoolInstance.idleCount;
    waitingCount = mockPoolInstance.waitingCount;
  }
  return { Pool: MockPool };
});

vi.mock('@revealui/utils/database', () => ({
  getSSLConfig: vi.fn(() => false),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

let originalEnv: NodeJS.ProcessEnv;

describe('formatValidatedStatementTimeoutMs', () => {
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('formats a finite positive integer as a bare numeric string', async () => {
    const { formatValidatedStatementTimeoutMs } = await import('../pool.js');
    expect(formatValidatedStatementTimeoutMs(10000)).toBe('10000');
    expect(formatValidatedStatementTimeoutMs(1)).toBe('1');
  });

  it('accepts a numeric string and formats it as a bare numeric string', async () => {
    const { formatValidatedStatementTimeoutMs } = await import('../pool.js');
    expect(formatValidatedStatementTimeoutMs('300000')).toBe('300000');
  });

  it('rejects non-finite values', async () => {
    const { formatValidatedStatementTimeoutMs } = await import('../pool.js');
    expect(() => formatValidatedStatementTimeoutMs(Number.NaN)).toThrow(
      'invalid statement_timeout value',
    );
    expect(() => formatValidatedStatementTimeoutMs(Number.POSITIVE_INFINITY)).toThrow(
      'invalid statement_timeout value',
    );
  });

  it('rejects non-integer values', async () => {
    const { formatValidatedStatementTimeoutMs } = await import('../pool.js');
    expect(() => formatValidatedStatementTimeoutMs(10.5)).toThrow(
      'invalid statement_timeout value',
    );
  });

  it('rejects zero and negative values', async () => {
    const { formatValidatedStatementTimeoutMs } = await import('../pool.js');
    expect(() => formatValidatedStatementTimeoutMs(0)).toThrow('invalid statement_timeout value');
    expect(() => formatValidatedStatementTimeoutMs(-1)).toThrow('invalid statement_timeout value');
  });

  it('rejects a non-numeric string', async () => {
    const { formatValidatedStatementTimeoutMs } = await import('../pool.js');
    expect(() => formatValidatedStatementTimeoutMs('not-a-number')).toThrow(
      'invalid statement_timeout value',
    );
  });
});

describe('onPoolConnect setup query', () => {
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('issues one multi-statement SET query with the timeout interpolated as a literal, never a $1 placeholder', async () => {
    const { getPool } = await import('../pool.js');
    void getPool().totalCount;

    const connectCall = mockPoolInstance.on.mock.calls.find(
      (call: [string, unknown]) => call[0] === 'connect',
    );
    expect(connectCall).toBeDefined();
    const onConnect = connectCall?.[1] as (client: unknown) => void;

    const fakeClient = { query: vi.fn().mockResolvedValue({ rows: [] }), processID: 1 };
    onConnect(fakeClient);
    // The setup query runs in a detached (fire-and-forget) async flow off the
    // synchronous 'connect' event handler; flush microtasks so it lands.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fakeClient.query).toHaveBeenCalledTimes(1);
    const [sql] = fakeClient.query.mock.calls[0] as [string];
    expect(sql).not.toContain('$1');
    expect(sql).toContain("SET timezone TO 'UTC'");
    expect(sql).toContain('SET statement_timeout TO 10000');
    expect(sql).toContain('SET track_io_timing = on');
  });
});
