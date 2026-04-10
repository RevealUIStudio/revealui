/**
 * Log Ingestion Route Tests
 *
 * Covers: POST / (unauthenticated, fire-and-forget, OpenAPIHono)
 * across schema validation, DB write, and failure fallback scenarios.
 *
 * Only warn/error/fatal levels are accepted; info/debug are rejected by the schema.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────

vi.mock('@revealui/db/schema', () => ({
  appLogs: 'appLogs',
}));

const mockInsertValues = vi.fn();
const mockDb = { insert: vi.fn() };

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import logsApp from '../logs.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function post(body: unknown, token?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Pass undefined to omit the header entirely; null also omits it
  const tok = token === undefined ? (process.env.REVEALUI_SECRET ?? 'test-secret') : token;
  if (tok !== null) headers['X-Internal-Token'] = tok;
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Flush macrotask queue so detached async IIFEs can complete. */
async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertValues.mockResolvedValue({ rowCount: 1 });
  mockDb.insert.mockReturnValue({ values: mockInsertValues });
  process.env.NODE_ENV = 'test';
  process.env.REVEALUI_SECRET = 'test-secret';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST / — schema validation', () => {
  it('returns 202 with received:true on valid warn payload', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'Low disk space', app: 'admin' }),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  it('returns 202 on full valid payload', async () => {
    const res = await logsApp.request(
      post({
        level: 'error',
        message: 'Unhandled rejection',
        app: 'api',
        environment: 'production',
        requestId: 'req-123',
        userId: 'user-456',
        data: { code: 'ECONNRESET' },
      }),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  it('accepts all three valid levels (warn, error, fatal)', async () => {
    for (const level of ['warn', 'error', 'fatal'] as const) {
      const res = await logsApp.request(post({ level, message: 'test', app: 'admin' }));
      expect(res.status).toBe(202);
    }
  });

  it('returns 400 when level is info (not in schema enum)', async () => {
    const res = await logsApp.request(
      post({ level: 'info', message: 'Informational', app: 'admin' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when level is debug', async () => {
    const res = await logsApp.request(post({ level: 'debug', message: 'Debug msg', app: 'api' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is missing', async () => {
    const res = await logsApp.request(post({ level: 'error', app: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when app is missing', async () => {
    const res = await logsApp.request(post({ level: 'warn', message: 'Missing app' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when level is missing', async () => {
    const res = await logsApp.request(post({ message: 'No level', app: 'admin' }));
    expect(res.status).toBe(400);
  });
});

describe('POST / — fire-and-forget DB write', () => {
  it('returns 202 even when DB insert throws', async () => {
    mockInsertValues.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await logsApp.request(
      post({ level: 'error', message: 'DB write will fail', app: 'admin' }),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.received).toBe(true);
  });

  it('inserts with correct fields from payload', async () => {
    await logsApp.request(
      post({
        level: 'fatal',
        message: 'Process crashed',
        app: 'api',
        environment: 'staging',
        requestId: 'req-abc',
        userId: 'u-999',
        data: { code: 1 },
      }),
    );
    await flushAsync();

    expect(mockDb.insert).toHaveBeenCalledWith('appLogs');
    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.level).toBe('fatal');
    expect(insertArgs.message).toBe('Process crashed');
    expect(insertArgs.app).toBe('api');
    expect(insertArgs.environment).toBe('staging');
    expect(insertArgs.requestId).toBe('req-abc');
    expect(insertArgs.userId).toBeNull(); // userId is not accepted from untrusted clients
    expect(insertArgs.data).toEqual({ code: 1 });
  });

  it('defaults environment to process.env.NODE_ENV when not in payload', async () => {
    process.env.NODE_ENV = 'production';

    await logsApp.request(post({ level: 'warn', message: 'No env field', app: 'admin' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.environment).toBe('production');
  });

  it('sets requestId to null when not provided', async () => {
    await logsApp.request(post({ level: 'warn', message: 'No requestId', app: 'admin' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.requestId).toBeNull();
  });

  it('sets userId to null when not provided', async () => {
    await logsApp.request(post({ level: 'error', message: 'No userId', app: 'api' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.userId).toBeNull();
  });

  it('sets data to null when not provided', async () => {
    await logsApp.request(post({ level: 'fatal', message: 'No data', app: 'admin' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.data).toBeNull();
  });
});

describe('POST / — authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue({ rowCount: 1 });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('returns 403 when X-Internal-Token header is absent', async () => {
    // Pass null to omit the header
    const res = await logsApp.request(post({ level: 'warn', message: 'hi', app: 'admin' }, null));
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is wrong', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'hi', app: 'admin' }, 'wrong-secret'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when token has a different length (timing-safe branch)', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'hi', app: 'admin' }, 'short'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when REVEALUI_SECRET env var is unset', async () => {
    delete process.env.REVEALUI_SECRET;
    const res = await logsApp.request(post({ level: 'warn', message: 'hi', app: 'admin' }));
    expect(res.status).toBe(403);
  });

  it('does not call DB insert on auth failure', async () => {
    const res = await logsApp.request(
      post({ level: 'error', message: 'attempt', app: 'api' }, 'bad-token'),
    );
    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe('POST / — input sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue({ rowCount: 1 });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('strips newlines from message', async () => {
    await logsApp.request(post({ level: 'warn', message: 'line1\nline2\r\nline3', app: 'admin' }));
    await new Promise((r) => setTimeout(r, 0));

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.message).toBe('line1 line2  line3');
  });

  it('returns 400 when message exceeds 2000 characters', async () => {
    const res = await logsApp.request(
      post({ level: 'error', message: 'x'.repeat(2001), app: 'admin' }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts message at exactly 2000 characters', async () => {
    const res = await logsApp.request(
      post({ level: 'error', message: 'x'.repeat(2000), app: 'admin' }),
    );
    expect(res.status).toBe(202);
  });

  it('returns 400 when app name exceeds 50 characters', async () => {
    const res = await logsApp.request(post({ level: 'warn', message: 'hi', app: 'a'.repeat(51) }));
    expect(res.status).toBe(400);
  });
});

describe('POST / — field length boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue({ rowCount: 1 });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('accepts app name at exactly 50 characters', async () => {
    const res = await logsApp.request(post({ level: 'warn', message: 'hi', app: 'a'.repeat(50) }));
    expect(res.status).toBe(202);
  });

  it('accepts requestId at exactly 255 characters', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'hi', app: 'admin', requestId: 'r'.repeat(255) }),
    );
    expect(res.status).toBe(202);
  });

  it('returns 400 when requestId exceeds 255 characters', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'hi', app: 'admin', requestId: 'r'.repeat(256) }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts environment at exactly 50 characters', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'hi', app: 'admin', environment: 'e'.repeat(50) }),
    );
    expect(res.status).toBe(202);
  });

  it('returns 400 when environment exceeds 50 characters', async () => {
    const res = await logsApp.request(
      post({ level: 'warn', message: 'hi', app: 'admin', environment: 'e'.repeat(51) }),
    );
    expect(res.status).toBe(400);
  });

  it('strips standalone \\r from message', async () => {
    await logsApp.request(post({ level: 'warn', message: 'line1\rline2', app: 'admin' }));
    await new Promise((r) => setTimeout(r, 0));
    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.message).toBe('line1 line2');
  });

  it('preserves complex nested data object', async () => {
    const data = { nested: { key: 'value' }, arr: [1, 2, 3], flag: true };
    await logsApp.request(post({ level: 'error', message: 'test', app: 'api', data }));
    await new Promise((r) => setTimeout(r, 0));
    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.data).toEqual(data);
  });
});

describe('POST / — environment fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue({ rowCount: 1 });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('defaults environment to "production" when neither payload nor NODE_ENV is set', async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    await logsApp.request(post({ level: 'warn', message: 'no env', app: 'admin' }));
    await new Promise((r) => setTimeout(r, 0));
    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.environment).toBe('production');
    process.env.NODE_ENV = savedNodeEnv;
  });
});

// ---------------------------------------------------------------------------
// notFound handler
// ---------------------------------------------------------------------------

describe('notFound handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('returns 404 for GET /', async () => {
    const res = await logsApp.request(new Request('http://localhost/', { method: 'GET' }));
    expect(res.status).toBe(404);
  });

  it('returns 404 for POST to unknown sub-path', async () => {
    const res = await logsApp.request(
      new Request('http://localhost/other', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': 'test-secret',
        },
        body: JSON.stringify({ level: 'warn', message: 'hi', app: 'admin' }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// stderr on DB failure (logTransportError)
// ---------------------------------------------------------------------------

describe('POST / — stderr on DB failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue({ rowCount: 1 });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('writes to stderr when DB insert fails', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockInsertValues.mockRejectedValueOnce(new Error('connection reset'));

    await logsApp.request(post({ level: 'error', message: 'will fail', app: 'admin' }));
    await flushAsync();

    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = stderrSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('[log-ingest]');
    expect(output).toContain('connection reset');
    stderrSpy.mockRestore();
  });

  it('handles non-Error thrown values in stderr output', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockInsertValues.mockRejectedValueOnce('timeout string');

    await logsApp.request(post({ level: 'error', message: 'will fail', app: 'admin' }));
    await flushAsync();

    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = stderrSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('timeout string');
    stderrSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Additional validation edge cases
// ---------------------------------------------------------------------------

describe('POST / — additional validation edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue({ rowCount: 1 });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });
    process.env.REVEALUI_SECRET = 'test-secret';
  });

  it('returns 400 on empty JSON object (missing required fields)', async () => {
    const res = await logsApp.request(post({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for unrecognized level string', async () => {
    const res = await logsApp.request(post({ level: 'critical', message: 'hi', app: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('ignores extra unknown fields and returns 202', async () => {
    const res = await logsApp.request(
      post({
        level: 'warn',
        message: 'test',
        app: 'admin',
        extraField: 'should be ignored',
        anotherExtra: 123,
      }),
    );
    expect(res.status).toBe(202);
  });

  it('accepts data with null values in the record', async () => {
    const res = await logsApp.request(
      post({
        level: 'error',
        message: 'test',
        app: 'api',
        data: { key: null, nested: { a: 1 } },
      }),
    );
    expect(res.status).toBe(202);
  });

  it('rejects invalid JSON body', async () => {
    const res = await logsApp.request(
      new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': 'test-secret',
        },
        body: 'not-json{{{',
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('returns 400 when level is a number', async () => {
    const res = await logsApp.request(post({ level: 42, message: 'hi', app: 'admin' }));
    expect(res.status).toBe(400);
  });

  it('accepts minimal valid payload (only required fields)', async () => {
    const res = await logsApp.request(post({ level: 'fatal', message: 'x', app: 'a' }));
    expect(res.status).toBe(202);
  });
});
