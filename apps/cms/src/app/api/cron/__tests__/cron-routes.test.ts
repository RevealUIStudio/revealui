/**
 * Tests for cron cleanup routes (co-located):
 * - GET /api/cron/cleanup-all (consolidated daily cleanup)
 * - GET /api/cron/cleanup-sessions (hourly session cleanup)
 *
 * All routes delegate to @revealui/db cleanupStaleTokens().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCleanupStaleTokens = vi.fn();
const mockVerifyCronAuth = vi.fn();

vi.mock('@revealui/db/cleanup', () => ({
  cleanupStaleTokens: (...args: unknown[]) => mockCleanupStaleTokens(...args),
}));

vi.mock('@/lib/utils/cron-auth', () => ({
  verifyCronAuth: (...args: unknown[]) => mockVerifyCronAuth(...args),
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

function makeRequest() {
  return {} as never;
}

/** Default cleanup result (all zeros) */
function makeResult(overrides: Partial<Record<string, number>> = {}) {
  return {
    sessions: 0,
    rateLimits: 0,
    passwordResetTokens: 0,
    magicLinks: 0,
    scheduledPages: 0,
    ...overrides,
  };
}

// ─── GET /api/cron/cleanup-all ──────────────────────────────────────────────

describe('GET /api/cron/cleanup-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../cleanup-all/route.js');
    return mod.GET;
  }

  it('returns 401 when cron auth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns cleanup results on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    mockCleanupStaleTokens.mockResolvedValue(
      makeResult({ sessions: 5, rateLimits: 12, passwordResetTokens: 2, scheduledPages: 1 }),
    );

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: unknown }).body).toEqual({
      success: true,
      cleaned: {
        sessions: 5,
        rateLimits: 12,
        passwordResetTokens: 2,
        magicLinks: 0,
        scheduledPages: 1,
      },
    });
  });

  it('returns 500 when cleanup throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    mockCleanupStaleTokens.mockRejectedValue(new Error('DB connection lost'));

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(500);
    expect((res as unknown as { body: { error: string } }).body.error).toBe('DB connection lost');
  });
});

// ─── GET /api/cron/cleanup-sessions ─────────────────────────────────────────

describe('GET /api/cron/cleanup-sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../cleanup-sessions/route.js');
    return mod.GET;
  }

  it('returns 401 when cron auth fails', async () => {
    mockVerifyCronAuth.mockReturnValue(false);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns deleted session count on success', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    mockCleanupStaleTokens.mockResolvedValue(makeResult({ sessions: 3 }));

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { deleted: number } }).body.deleted).toBe(3);
    expect(mockCleanupStaleTokens).toHaveBeenCalledWith({ tables: ['sessions'] });
  });

  it('returns 500 when cleanup throws', async () => {
    mockVerifyCronAuth.mockReturnValue(true);
    mockCleanupStaleTokens.mockRejectedValue(new Error('Query failed'));

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(500);
  });
});
