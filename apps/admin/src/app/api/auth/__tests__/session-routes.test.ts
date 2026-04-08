/**
 * Tests for auth session routes:
 * - GET /api/auth/me
 * - GET /api/auth/session
 * - POST /api/auth/sign-out
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockGetLinkedProviders = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  getLinkedProviders: (...args: unknown[]) => mockGetLinkedProviders(...args),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/utils/error-response', () => {
  const { NextResponse } = require('next/server');
  return {
    createApplicationErrorResponse: (msg: string, code: string, status = 500) =>
      NextResponse.json({ error: msg, code }, { status }),
    createErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      ),
    createValidationErrorResponse: (msg: string) =>
      NextResponse.json({ error: msg }, { status: 400 }),
  };
});

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown, _opts?: unknown) => handler,
  rateLimit: () => () => Promise.resolve(null),
  rateLimitConfigs: {
    auth: { maxRequests: 5, windowMs: 900000 },
    api: { maxRequests: 100, windowMs: 60000 },
  },
}));

vi.mock('next/server', () => {
  class MockCookies {
    private deleted: string[] = [];
    delete(name: string) {
      this.deleted.push(name);
    }
    getDeleted() {
      return this.deleted;
    }
  }
  class MockNextResponse {
    body: unknown;
    status: number;
    cookies: MockCookies;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.cookies = new MockCookies();
    }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

function makeRequest() {
  return {
    headers: {
      get: () => null,
    },
  } as never;
}

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../me/route.js');
    return mod.GET;
  }

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns user data with linked providers', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        role: 'user',
        status: 'active',
        emailVerified: true,
        password: 'hashed',
      },
    });
    mockGetLinkedProviders.mockResolvedValue([
      { provider: 'github', providerEmail: 'gh@example.com', providerName: 'ghuser' },
    ]);

    const GET = await loadRoute();
    const res = await GET(makeRequest());
    const body = (res as unknown as { body: Record<string, unknown> }).body;

    expect((res as { status: number }).status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({
          id: 'user-1',
          email: 'test@example.com',
          hasPassword: true,
          linkedProviders: [{ provider: 'github', email: 'gh@example.com', name: 'ghuser' }],
        }),
      }),
    );
  });

  it('returns user even when linked providers fetch fails', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'user',
        status: 'active',
      },
    });
    mockGetLinkedProviders.mockRejectedValue(new Error('DB error'));

    const GET = await loadRoute();
    const res = await GET(makeRequest());
    const body = (res as unknown as { body: Record<string, unknown> }).body;

    expect((res as { status: number }).status).toBe(200);
    expect((body as { user: { linkedProviders: unknown[] } }).user.linkedProviders).toEqual([]);
  });
});

// ─── GET /api/auth/session ──────────────────────────────────────────────────

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../session/route.js');
    return mod.GET;
  }

  it('returns 401 when no session', async () => {
    mockGetSession.mockResolvedValue(null);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns user and session data', async () => {
    const expiresAt = new Date('2026-04-01T00:00:00Z');
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        avatarUrl: null,
        role: 'user',
      },
      session: { id: 'session-1', expiresAt },
    });

    const GET = await loadRoute();
    const res = await GET(makeRequest());
    const body = (res as unknown as { body: Record<string, unknown> }).body;

    expect((res as { status: number }).status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user-1' }),
        session: expect.objectContaining({
          id: 'session-1',
          expiresAt: '2026-04-01T00:00:00.000Z',
        }),
      }),
    );
  });
});

// ─── POST /api/auth/sign-out ────────────────────────────────────────────────

describe('POST /api/auth/sign-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../sign-out/route.js');
    return mod.POST;
  }

  it('deletes session and clears cookies on success', async () => {
    mockDeleteSession.mockResolvedValue(undefined);
    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { success: boolean } }).body.success).toBe(true);
    expect(mockDeleteSession).toHaveBeenCalled();

    // Verify cookies are deleted
    const cookies = (
      res as unknown as { cookies: { getDeleted: () => string[] } }
    ).cookies.getDeleted();
    expect(cookies).toContain('revealui-session');
    expect(cookies).toContain('revealui-role');
  });

  it('returns error response when deleteSession throws', async () => {
    mockDeleteSession.mockRejectedValue(new Error('Session not found'));
    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(500);
  });
});
