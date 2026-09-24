import { describe, expect, it, vi } from 'vitest';
import {
  backoffMs,
  DEFAULT_AUDIT_ANCHOR_DB_RETRY,
  isSqlOrQueryError,
  isTransientDbConnectError,
  resolveAuditAnchorDbRetry,
  withTransientDbRetry,
} from '../audit-anchor-db-retry.js';

function drizzleWrapped(cause: Error, query = 'select 1'): Error {
  const wrapped = new Error(`Failed query: ${query}\nparams: `);
  wrapped.cause = cause;
  return wrapped;
}

function neonConnectError(): Error {
  const fetchErr = new TypeError('fetch failed');
  const neon = new Error('Error connecting to database: TypeError: fetch failed');
  neon.name = 'NeonDbError';
  neon.cause = fetchErr;
  return drizzleWrapped(neon, 'select count(*) from "audit_log"');
}

function schemaError(): Error {
  const pg = new Error('relation "audit_log" does not exist');
  pg.name = 'NeonDbError';
  (pg as Error & { code?: string }).code = '42P01';
  return drizzleWrapped(pg);
}

describe('isTransientDbConnectError', () => {
  it('treats a Drizzle-wrapped Neon fetch failure as transient', () => {
    expect(isTransientDbConnectError(neonConnectError())).toBe(true);
    expect(isSqlOrQueryError(neonConnectError())).toBe(false);
  });

  it('treats a bare fetch TypeError and connect codes as transient', () => {
    expect(isTransientDbConnectError(new TypeError('fetch failed'))).toBe(true);
    const reset = new Error('socket hang up');
    (reset as Error & { code?: string }).code = 'ECONNRESET';
    expect(isTransientDbConnectError(reset)).toBe(true);
  });

  it('does not treat schema or syntax failures as transient', () => {
    expect(isTransientDbConnectError(schemaError())).toBe(false);
    expect(isSqlOrQueryError(schemaError())).toBe(true);
    const syntax = new Error('Failed query: select from\nparams: ');
    expect(isTransientDbConnectError(syntax)).toBe(false);
    expect(isSqlOrQueryError(syntax)).toBe(true);
  });

  it('does not treat an unknown error as transient', () => {
    expect(isTransientDbConnectError(new Error('signer key rejected'))).toBe(false);
    expect(isSqlOrQueryError(new Error('signer key rejected'))).toBe(false);
  });
});

describe('withTransientDbRetry', () => {
  it('retries transient failures with exponential backoff then returns', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await withTransientDbRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw neonConnectError();
        return 'ok';
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 40 },
      async (ms) => {
        sleeps.push(ms);
      },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([10, 20]);
  });

  it('does not retry schema errors', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    await expect(
      withTransientDbRetry(
        async () => {
          calls += 1;
          throw schemaError();
        },
        { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 40 },
        sleep,
      ),
    ).rejects.toThrow('Failed query:');
    expect(calls).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws the last transient error when attempts are exhausted', async () => {
    let calls = 0;
    await expect(
      withTransientDbRetry(
        async () => {
          calls += 1;
          throw neonConnectError();
        },
        { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
        async () => {},
      ),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof Error &&
        err.message.includes('Failed query:') &&
        err.cause instanceof Error &&
        err.cause.message.includes('fetch failed')
      );
    });
    expect(calls).toBe(2);
  });
});

describe('resolveAuditAnchorDbRetry', () => {
  it('uses defaults and clamps env overrides', () => {
    expect(resolveAuditAnchorDbRetry({})).toEqual(DEFAULT_AUDIT_ANCHOR_DB_RETRY);
    expect(
      resolveAuditAnchorDbRetry({
        AUDIT_ANCHOR_DB_RETRY_ATTEMPTS: '100',
        AUDIT_ANCHOR_DB_RETRY_BASE_MS: '50',
        AUDIT_ANCHOR_DB_RETRY_MAX_MS: 'not-a-number',
      }),
    ).toEqual({
      maxAttempts: 5,
      baseDelayMs: 50,
      maxDelayMs: DEFAULT_AUDIT_ANCHOR_DB_RETRY.maxDelayMs,
    });
  });

  it('prefers explicit overrides over env', () => {
    expect(
      resolveAuditAnchorDbRetry(
        { AUDIT_ANCHOR_DB_RETRY_ATTEMPTS: '4' },
        { maxAttempts: 1, baseDelayMs: 0 },
      ),
    ).toMatchObject({ maxAttempts: 1, baseDelayMs: 0 });
  });
});

describe('backoffMs', () => {
  it('doubles until the cap', () => {
    const config = { maxAttempts: 5, baseDelayMs: 200, maxDelayMs: 500 };
    expect(backoffMs(1, config)).toBe(200);
    expect(backoffMs(2, config)).toBe(400);
    expect(backoffMs(3, config)).toBe(500);
  });
});
