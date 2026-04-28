/**
 * provisionGitHubAccess  -  unit tests (GAP-011)
 *
 * Covers: successful provisioning, pending state, unexpected state warning,
 * retry on transient failure, permanent failure with app_logs write.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks  -  hoisted before imports ──────────────────────────────────────────

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
import { provisionGitHubAccess } from '../webhook-emails.js';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

function makeDb() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  return {
    db: { insert } as unknown as Parameters<typeof provisionGitHubAccess>[1],
    insert,
    values,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('provisionGitHubAccess', () => {
  beforeEach(() => {
    process.env.REVEALUI_GITHUB_TOKEN = 'ghp_test_token_123';
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.REVEALUI_GITHUB_TOKEN;
  });

  it('skips and warns when REVEALUI_GITHUB_TOKEN is not set', async () => {
    delete process.env.REVEALUI_GITHUB_TOKEN;

    await provisionGitHubAccess('alice');

    expect(mockFetchWithRetry).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not configured'),
      expect.objectContaining({ githubUsername: 'alice' }),
    );
  });

  it('provisions successfully and logs active state', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      json: async () => ({ state: 'active', role: 'member', url: 'https://api.github.com/...' }),
    });

    await provisionGitHubAccess('alice');

    expect(mockFetchWithRetry).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      'GitHub team access provisioned',
      expect.objectContaining({ githubUsername: 'alice', state: 'active' }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('treats pending state as success (user invited, not yet accepted)', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      json: async () => ({ state: 'pending', role: 'member', url: 'https://api.github.com/...' }),
    });

    await provisionGitHubAccess('bob');

    expect(logger.info).toHaveBeenCalledWith(
      'GitHub team access provisioned',
      expect.objectContaining({ githubUsername: 'bob', state: 'pending' }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a warning for unexpected membership state but does not throw', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      json: async () => ({ state: 'blocked', role: 'member', url: 'https://api.github.com/...' }),
    });

    await expect(provisionGitHubAccess('carol')).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unexpected membership state'),
      expect.objectContaining({ githubUsername: 'carol', state: 'blocked' }),
    );
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('throws and writes to app_logs after all retries exhausted', async () => {
    const { db, insert, values } = makeDb();
    mockFetchWithRetry.mockRejectedValueOnce(new Error('HTTP 503: Service Unavailable'));

    await expect(provisionGitHubAccess('dave', db)).rejects.toThrow('HTTP 503');

    expect(logger.error).toHaveBeenCalledWith(
      'GitHub team provisioning failed after all retries',
      expect.objectContaining({ message: 'HTTP 503: Service Unavailable' }),
      expect.objectContaining({ githubUsername: 'dave' }),
    );
    expect(insert).toHaveBeenCalledWith('appLogs_sentinel');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: 'GitHub team provisioning failed after all retries',
        app: 'api',
        data: expect.objectContaining({ githubUsername: 'dave' }),
      }),
    );
  });

  it('throws without a db write when no db is provided', async () => {
    const { insert } = makeDb();
    mockFetchWithRetry.mockRejectedValueOnce(new Error('timeout'));

    await expect(provisionGitHubAccess('eve')).rejects.toThrow('timeout');

    expect(logger.error).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('passes correct headers and body to GitHub API', async () => {
    mockFetchWithRetry.mockResolvedValueOnce({
      json: async () => ({ state: 'active', role: 'member', url: '' }),
    });

    await provisionGitHubAccess('frank');

    const [url, init] = mockFetchWithRetry.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/memberships/frank');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer ghp_test_token_123',
    );
    expect(JSON.parse(init.body as string)).toEqual({ role: 'member' });
  });
});
