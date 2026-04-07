/**
 * Cron Route Tests
 *
 * GET /api/cron/cleanup-all              — consolidated cleanup (admin + verifyCronAuth)
 * GET /api/cron/cleanup-sessions         — expired/revoked sessions
 * GET /api/cron/cleanup-rate-limits      — expired rate limit records
 * GET /api/cron/cleanup-magic-links      — expired magic links
 * GET /api/cron/cleanup-password-reset-tokens — expired password reset tokens
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before route imports
// ---------------------------------------------------------------------------

const { mockVerifyCronAuth, mockCleanupStaleTokens, mockGetClient } = vi.hoisted(() => ({
  mockVerifyCronAuth: vi.fn(),
  mockCleanupStaleTokens: vi.fn(),
  mockGetClient: vi.fn(),
}));

vi.mock('@/lib/utils/cron-auth', () => ({ verifyCronAuth: mockVerifyCronAuth }));
vi.mock('@revealui/db/cleanup', () => ({ cleanupStaleTokens: mockCleanupStaleTokens }));
vi.mock('@revealui/db', () => ({ getClient: mockGetClient }));

// drizzle-orm operators — just pass-through identity so where() args don't error
vi.mock('drizzle-orm', () => ({
  lt: vi.fn((_col: unknown, _val: unknown) => 'lt-condition'),
  isNotNull: vi.fn((_col: unknown) => 'is-not-null-condition'),
  or: vi.fn((..._args: unknown[]) => 'or-condition'),
}));

// schema tables — plain objects (only used as .delete() arguments)
vi.mock('@revealui/db/schema', () => ({
  sessions: {},
  rateLimits: {},
  magicLinks: {},
  passwordResetTokens: {},
  lt: vi.fn((_col: unknown, _val: unknown) => 'lt-condition'),
  isNotNull: vi.fn((_col: unknown) => 'is-not-null-condition'),
  or: vi.fn((..._args: unknown[]) => 'or-condition'),
}));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as cleanupAll } from '../../app/api/cron/cleanup-all/route';
import { GET as cleanupMagicLinks } from '../../app/api/cron/cleanup-magic-links/route';
import { GET as cleanupPasswordResetTokens } from '../../app/api/cron/cleanup-password-reset-tokens/route';
import { GET as cleanupRateLimits } from '../../app/api/cron/cleanup-rate-limits/route';
import { GET as cleanupSessions } from '../../app/api/cron/cleanup-sessions/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = 'test-cron-secret';

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost/api/cron/${path}`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
}

/** Build a chainable Drizzle mock where .returning() resolves to `rows` */
function makeDbChain(rows: unknown[] = []) {
  const chain = {
    delete: vi.fn(),
    where: vi.fn(),
    returning: vi.fn().mockResolvedValue(rows),
  };
  chain.delete.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests — GET /api/cron/cleanup-all
// ---------------------------------------------------------------------------

describe('GET /api/cron/cleanup-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_CRON_SECRET = CRON_SECRET;
  });

  it('returns 401 when verifyCronAuth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const res = await cleanupAll(makeRequest('cleanup-all'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 200 with cleaned counts on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    mockCleanupStaleTokens.mockResolvedValue({
      sessions: 3,
      rateLimits: 10,
      passwordResetTokens: 2,
      magicLinks: 1,
      scheduledPages: 0,
    });
    const res = await cleanupAll(makeRequest('cleanup-all'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cleaned.sessions).toBe(3);
    expect(body.cleaned.rateLimits).toBe(10);
    expect(body.cleaned.passwordResetTokens).toBe(2);
    expect(body.cleaned.magicLinks).toBe(1);
    expect(body.cleaned.scheduledPages).toBe(0);
  });

  it('returns 500 when cleanupStaleTokens throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    mockCleanupStaleTokens.mockRejectedValue(new Error('DB connection lost'));
    const res = await cleanupAll(makeRequest('cleanup-all'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DB connection lost');
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/cron/cleanup-sessions
// ---------------------------------------------------------------------------

describe('GET /api/cron/cleanup-sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when verifyCronAuth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const res = await cleanupSessions(makeRequest('cleanup-sessions'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with deleted count on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain([{}, {}, {}]); // 3 deleted rows
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupSessions(makeRequest('cleanup-sessions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(3);
  });

  it('returns 500 when DB throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain();
    chain.returning.mockRejectedValue(new Error('timeout'));
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupSessions(makeRequest('cleanup-sessions'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('timeout');
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/cron/cleanup-rate-limits
// ---------------------------------------------------------------------------

describe('GET /api/cron/cleanup-rate-limits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when verifyCronAuth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const res = await cleanupRateLimits(makeRequest('cleanup-rate-limits'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with deleted count on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain([{}]); // 1 deleted
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupRateLimits(makeRequest('cleanup-rate-limits'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(1);
  });

  it('returns 500 when DB throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain();
    chain.returning.mockRejectedValue(new Error('DB error'));
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupRateLimits(makeRequest('cleanup-rate-limits'));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/cron/cleanup-magic-links
// ---------------------------------------------------------------------------

describe('GET /api/cron/cleanup-magic-links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when verifyCronAuth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const res = await cleanupMagicLinks(makeRequest('cleanup-magic-links'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with deleted count on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain([{}, {}]); // 2 deleted
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupMagicLinks(makeRequest('cleanup-magic-links'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(2);
  });

  it('returns 500 when DB throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain();
    chain.returning.mockRejectedValue(new Error('DB error'));
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupMagicLinks(makeRequest('cleanup-magic-links'));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/cron/cleanup-password-reset-tokens
// ---------------------------------------------------------------------------

describe('GET /api/cron/cleanup-password-reset-tokens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when verifyCronAuth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const res = await cleanupPasswordResetTokens(makeRequest('cleanup-password-reset-tokens'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with deleted count on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain([{}]); // 1 deleted
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupPasswordResetTokens(makeRequest('cleanup-password-reset-tokens'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(1);
  });

  it('returns 500 when DB throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    const chain = makeDbChain();
    chain.returning.mockRejectedValue(new Error('DB error'));
    mockGetClient.mockReturnValue(chain);
    const res = await cleanupPasswordResetTokens(makeRequest('cleanup-password-reset-tokens'));
    expect(res.status).toBe(500);
  });
});
