/**
 * Error Capture Route Tests
 *
 * Covers: POST / (unauthenticated, fire-and-forget)
 * across payload validation, DB write, and failure fallback scenarios.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — declared before imports so vi.mock hoisting takes effect ─────────
//
// `mockLoggerError` is used inside the vi.mock factory, which is hoisted to the
// top of the file before any const declarations are initialized. vi.hoisted()
// ensures the variable is available when the factory is invoked.

const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: mockLoggerError },
}));

vi.mock('@revealui/db/schema', () => ({
  errorEvents: 'errorEvents',
}));

const mockInsertValues = vi.fn();
const mockDb = { insert: vi.fn() };

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

// ─── Import under test (after mocks) ─────────────────────────────────────────

import errorsApp from '../errors.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function post(body: unknown, raw = false, token?: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // undefined = use env secret (default); null = omit header entirely
  const tok = token === undefined ? (process.env.REVEALUI_SECRET ?? 'test-secret') : token;
  if (tok !== null) headers['X-Internal-Token'] = tok;
  return new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: raw ? String(body) : JSON.stringify(body),
  });
}

/** Flush macrotask queue so detached async IIFEs can complete. */
async function flushAsync() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const originalNodeEnv = process.env.NODE_ENV;
const originalRevealUiSecret = process.env.REVEALUI_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertValues.mockResolvedValue({ rowCount: 1 });
  mockDb.insert.mockReturnValue({ values: mockInsertValues });
  process.env.NODE_ENV = 'test';
  process.env.REVEALUI_SECRET = 'test-secret';
});

afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  process.env.REVEALUI_SECRET = originalRevealUiSecret;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST / — payload validation', () => {
  it('returns 202 with success:true on minimal valid payload', async () => {
    const res = await errorsApp.request(post({ message: 'Something broke', app: 'cms' }));
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('returns 202 with success:true on full valid payload', async () => {
    const res = await errorsApp.request(
      post({
        level: 'fatal',
        message: 'Uncaught exception',
        stack: 'Error: Oops\n  at handler (index.ts:42)',
        app: 'cms',
        context: 'AdminDashboard',
        environment: 'production',
        url: 'https://admin.revealui.com/admin',
        userId: 'user-abc',
        requestId: 'req-xyz',
        metadata: { extra: true },
      }),
    );
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('defaults level to error when omitted', async () => {
    await errorsApp.request(post({ message: 'No level field', app: 'cms' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.level).toBe('error');
  });

  it('returns 400 on malformed JSON body', async () => {
    const res = await errorsApp.request(post('not-json{{{', true));
    expect(res.status).toBe(400);
    // OpenAPI framework returns a text error for malformed JSON, not JSON
    const text = await res.text();
    expect(text).toBeTruthy();
  });

  it('returns 400 when message is missing', async () => {
    const res = await errorsApp.request(post({ app: 'cms' }));
    expect(res.status).toBe(400);
    // zod-openapi wraps validation errors in { success: false, error: ZodError }
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    const error = body.error as Record<string, unknown>;
    expect(error.name).toBe('ZodError');
  });

  it('returns 400 when app is missing', async () => {
    const res = await errorsApp.request(post({ message: 'Error occurred' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    const error = body.error as Record<string, unknown>;
    expect(error.name).toBe('ZodError');
  });

  it('returns 400 when level is not a valid enum value', async () => {
    const res = await errorsApp.request(post({ message: 'Bad level', app: 'cms', level: 'info' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    const error = body.error as Record<string, unknown>;
    expect(error.name).toBe('ZodError');
  });
});

describe('POST / — fire-and-forget DB write', () => {
  it('returns 202 even when DB insert throws', async () => {
    mockInsertValues.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await errorsApp.request(post({ message: 'Client error', app: 'cms' }));
    expect(res.status).toBe(202);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);
  });

  it('logs an error when DB insert fails', async () => {
    const dbErr = new Error('DB connection lost');
    mockInsertValues.mockRejectedValueOnce(dbErr);

    await errorsApp.request(post({ message: 'Client error', app: 'cms' }));
    await flushAsync();

    expect(mockLoggerError).toHaveBeenCalledOnce();
    const logMessage = mockLoggerError.mock.calls[0]?.[0] as string;
    expect(logMessage).toContain('failed to persist error event');
  });

  it('inserts correct fields including explicit environment', async () => {
    await errorsApp.request(
      post({
        level: 'warn',
        message: 'API timeout',
        app: 'api',
        environment: 'staging',
        userId: 'u-1',
        requestId: 'req-2',
      }),
    );
    await flushAsync();

    expect(mockDb.insert).toHaveBeenCalledWith('errorEvents');
    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.level).toBe('warn');
    expect(insertArgs.message).toBe('API timeout');
    expect(insertArgs.app).toBe('api');
    expect(insertArgs.environment).toBe('staging');
    expect(insertArgs.userId).toBeNull(); // userId is not accepted from untrusted clients
    expect(insertArgs.requestId).toBe('req-2');
    expect(typeof insertArgs.id).toBe('string'); // crypto.randomUUID()
  });

  it('defaults environment to process.env.NODE_ENV when not in payload', async () => {
    process.env.NODE_ENV = 'production';

    await errorsApp.request(post({ message: 'No env field', app: 'cms' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.environment).toBe('production');
  });

  it('passes metadata as-is when provided', async () => {
    await errorsApp.request(
      post({ message: 'With meta', app: 'cms', metadata: { buildId: '42', retry: true } }),
    );
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.metadata).toEqual({ buildId: '42', retry: true });
  });

  it('sets metadata to null when not provided', async () => {
    await errorsApp.request(post({ message: 'No meta', app: 'cms' }));
    await flushAsync();

    const insertArgs = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArgs.metadata).toBeNull();
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
    const res = await errorsApp.request(post({ message: 'test', app: 'cms' }, false, null));
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is wrong', async () => {
    const res = await errorsApp.request(
      post({ message: 'test', app: 'cms' }, false, 'wrong-secret'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when token has a different length (timing-safe branch)', async () => {
    const res = await errorsApp.request(post({ message: 'test', app: 'cms' }, false, 'short'));
    expect(res.status).toBe(403);
  });

  it('returns 403 when REVEALUI_SECRET env var is unset', async () => {
    delete process.env.REVEALUI_SECRET;
    const res = await errorsApp.request(post({ message: 'test', app: 'cms' }));
    expect(res.status).toBe(403);
  });

  it('does not call DB insert on auth failure', async () => {
    const res = await errorsApp.request(
      post({ message: 'attempt', app: 'api' }, false, 'bad-token'),
    );
    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe('POST / — input size limits', () => {
  it('returns 400 when message exceeds 2000 characters', async () => {
    const res = await errorsApp.request(post({ message: 'x'.repeat(2001), app: 'cms' }));
    expect(res.status).toBe(400);
  });

  it('accepts message at exactly 2000 characters', async () => {
    const res = await errorsApp.request(post({ message: 'x'.repeat(2000), app: 'cms' }));
    expect(res.status).toBe(202);
  });

  it('returns 400 when stack exceeds 10,000 characters', async () => {
    const res = await errorsApp.request(
      post({ message: 'Error', app: 'cms', stack: 'x'.repeat(10_001) }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when app name exceeds 50 characters', async () => {
    const res = await errorsApp.request(post({ message: 'Error', app: 'a'.repeat(51) }));
    expect(res.status).toBe(400);
  });

  it('accepts stack at exactly 10000 characters', async () => {
    const res = await errorsApp.request(
      post({ message: 'Error', app: 'cms', stack: 'x'.repeat(10_000) }),
    );
    expect(res.status).toBe(202);
  });

  it('returns 400 when context exceeds 50 characters', async () => {
    const res = await errorsApp.request(
      post({ message: 'Error', app: 'cms', context: 'c'.repeat(51) }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when url exceeds 2000 characters', async () => {
    const res = await errorsApp.request(
      post({ message: 'Error', app: 'cms', url: `https://example.com/${'x'.repeat(2000)}` }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when requestId exceeds 255 characters', async () => {
    const res = await errorsApp.request(
      post({ message: 'Error', app: 'cms', requestId: 'r'.repeat(256) }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when environment exceeds 50 characters', async () => {
    const res = await errorsApp.request(
      post({ message: 'Error', app: 'cms', environment: 'e'.repeat(51) }),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST / — non-Error thrown from DB', () => {
  it('wraps non-Error DB failure into an Error for logging', async () => {
    mockInsertValues.mockRejectedValueOnce('string-error-value');

    await errorsApp.request(post({ message: 'Client error', app: 'cms' }));
    await flushAsync();

    expect(mockLoggerError).toHaveBeenCalledOnce();
    const loggedError = mockLoggerError.mock.calls[0]?.[1] as Error;
    // Source wraps non-Error in new Error(String(err))
    expect(loggedError).toBeInstanceOf(Error);
    expect(loggedError.message).toBe('string-error-value');
  });
});
