/**
 * provisionNpmAccess — unit tests
 *
 * Covers: successful provisioning, missing token, non-OK response warning,
 * retry on transient failure, permanent failure with app_logs write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks — hoisted before imports ──────────────────────────────────────────

const { mockFetchWithRetry } = vi.hoisted(() => ({
  mockFetchWithRetry: vi.fn(),
}));

vi.mock('@revealui/core/error-handling', () => ({
  fetchWithRetry: mockFetchWithRetry,
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/db/schema', () => ({ appLogs: 'appLogs_sentinel' }));

vi.mock('../email.js', () => ({ sendEmail: vi.fn() }));

// ─── Subject under test ───────────────────────────────────────────────────────

import { logger } from '@revealui/core/observability/logger';
import { provisionNpmAccess } from '../webhook-emails.js';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

function makeDb() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  return {
    db: { insert } as unknown as Parameters<typeof provisionNpmAccess>[1],
    insert,
    values,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('provisionNpmAccess', () => {
  beforeEach(() => {
    process.env.REVEALUI_NPM_TOKEN = 'npm_test_token_abc123';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.REVEALUI_NPM_TOKEN;
  });

  it('skips and warns when REVEALUI_NPM_TOKEN is not set', async () => {
    delete process.env.REVEALUI_NPM_TOKEN;

    await provisionNpmAccess('alice');

    expect(mockFetchWithRetry).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not configured'),
      expect.objectContaining({ npmUsername: 'alice' }),
    );
  });

  it('provisions successfully and logs on 200 OK', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({ ok: true, status: 200 });

    await provisionNpmAccess('alice');

    expect(mockFetchWithRetry).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      'npm team access provisioned',
      expect.objectContaining({ npmUsername: 'alice' }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws on non-OK HTTP response', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(provisionNpmAccess('bob')).rejects.toThrow('npm team provisioning returned 404');

    expect(logger.error).toHaveBeenCalledWith(
      'npm team provisioning failed',
      undefined,
      expect.objectContaining({ npmUsername: 'bob', status: 404 }),
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('throws and writes to app_logs after all retries exhausted', async () => {
    const { db, insert, values } = makeDb();
    mockFetchWithRetry.mockRejectedValueOnce(new Error('HTTP 503: Service Unavailable'));

    await expect(provisionNpmAccess('carol', db)).rejects.toThrow('HTTP 503');

    expect(logger.error).toHaveBeenCalledWith(
      'npm team provisioning failed after all retries',
      expect.objectContaining({ message: 'HTTP 503: Service Unavailable' }),
      expect.objectContaining({ npmUsername: 'carol' }),
    );
    expect(insert).toHaveBeenCalledWith('appLogs_sentinel');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'npm team provisioning failed after all retries',
        app: 'api',
        data: expect.objectContaining({ npmUsername: 'carol' }),
      }),
    );
  });

  it('throws without a db write when no db is provided', async () => {
    const { insert } = makeDb();
    mockFetchWithRetry.mockRejectedValueOnce(new Error('timeout'));

    await expect(provisionNpmAccess('dave')).rejects.toThrow('timeout');

    expect(logger.error).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('passes correct URL, headers, and body to the npm registry API', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({ ok: true, status: 200 });

    await provisionNpmAccess('eve');

    const [url, init] = mockFetchWithRetry.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://registry.npmjs.org/-/team/revealui/revealui-pro-customers/user');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer npm_test_token_abc123',
    );
    expect(JSON.parse(init.body as string)).toEqual({ user: 'eve' });
  });
});
