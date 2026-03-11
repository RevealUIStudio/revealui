/**
 * Error Capture Route Tests
 *
 * Covers: POST / (unauthenticated, fire-and-forget)
 * across payload validation, DB write, and failure fallback scenarios.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function post(body: unknown, raw = false) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.REVEALUI_SECRET ?? 'test-secret',
    },
    body: raw ? String(body) : JSON.stringify(body),
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
        url: 'https://cms.revealui.com/admin',
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
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid JSON');
  });

  it('returns 400 when message is missing', async () => {
    const res = await errorsApp.request(post({ app: 'cms' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid payload');
  });

  it('returns 400 when app is missing', async () => {
    const res = await errorsApp.request(post({ message: 'Error occurred' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid payload');
  });

  it('returns 400 when level is not a valid enum value', async () => {
    const res = await errorsApp.request(post({ message: 'Bad level', app: 'cms', level: 'info' }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid payload');
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
