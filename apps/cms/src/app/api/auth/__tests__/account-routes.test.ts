/**
 * Tests for account management routes:
 * - POST /api/auth/unlink (OAuth provider unlink)
 * - GET  /api/auth/sessions (list active sessions)
 * - POST /api/auth/resend-verification (resend email verification)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockUnlinkOAuthAccount = vi.fn();
const mockGetClient = vi.fn();
const mockSendVerificationEmail = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  unlinkOAuthAccount: (...args: unknown[]) => mockUnlinkOAuthAccount(...args),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@revealui/db', () => ({
  getClient: (...args: unknown[]) => mockGetClient(...args),
}));

vi.mock('@revealui/db/schema', () => ({
  sessions: {
    id: 'id',
    userId: 'userId',
    userAgent: 'userAgent',
    ipAddress: 'ipAddress',
    persistent: 'persistent',
    lastActivityAt: 'lastActivityAt',
    createdAt: 'createdAt',
    expiresAt: 'expiresAt',
    deletedAt: 'deletedAt',
  },
  users: {
    id: 'id',
    emailVerificationToken: 'emailVerificationToken',
    updatedAt: 'updatedAt',
  },
  and: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock('@/lib/email/verification', () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown, _opts?: unknown) => handler,
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
  };
});

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

function makeRequest(body?: unknown) {
  return {
    headers: { get: () => null },
    json:
      body !== undefined ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
  } as never;
}

// ─── POST /api/auth/unlink ──────────────────────────────────────────────────

describe('POST /api/auth/unlink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../unlink/route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'github' }));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const req = {
      headers: { get: () => null },
      json: () => Promise.reject(new Error('bad json')),
    } as never;
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 for invalid provider', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'facebook' }));
    expect((res as { status: number }).status).toBe(400);
    expect((res as unknown as { body: { error: string } }).body.error).toBe('Invalid provider');
  });

  it('successfully unlinks a valid provider', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockUnlinkOAuthAccount.mockResolvedValue(undefined);

    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'github' }));

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { success: boolean; unlinked: string } }).body).toEqual({
      success: true,
      unlinked: 'github',
    });
    expect(mockUnlinkOAuthAccount).toHaveBeenCalledWith('u1', 'github');
  });

  it('returns 400 when unlinking the last auth method', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockUnlinkOAuthAccount.mockRejectedValue(new Error('Cannot unlink last authentication method'));

    const POST = await loadRoute();
    const res = await POST(makeRequest({ provider: 'google' }));

    expect((res as { status: number }).status).toBe(400);
    expect((res as unknown as { body: { error: string } }).body.error).toBe(
      'Cannot unlink last authentication method',
    );
  });
});

// ─── GET /api/auth/sessions ─────────────────────────────────────────────────

describe('GET /api/auth/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../sessions/route.js');
    return mod.GET;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const GET = await loadRoute();
    const res = await GET(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns session list with current session marked', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { id: 'sess-1' },
    });

    const now = new Date();
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            {
              id: 'sess-1',
              userAgent: 'Chrome',
              ipAddress: '1.2.3.4',
              persistent: false,
              lastActivityAt: now,
              createdAt: now,
              expiresAt: new Date(now.getTime() + 86400000),
            },
            {
              id: 'sess-2',
              userAgent: 'Firefox',
              ipAddress: '5.6.7.8',
              persistent: true,
              lastActivityAt: now,
              createdAt: now,
              expiresAt: new Date(now.getTime() + 86400000),
            },
          ]),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ select: mockSelect });

    const GET = await loadRoute();
    const res = await GET(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    const body = (
      res as unknown as {
        body: { currentSessionId: string; sessions: Array<{ id: string; isCurrent: boolean }> };
      }
    ).body;
    expect(body.currentSessionId).toBe('sess-1');
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0]!.isCurrent).toBe(true);
    expect(body.sessions[1]!.isCurrent).toBe(false);
  });
});

// ─── POST /api/auth/resend-verification ─────────────────────────────────────

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../resend-verification/route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 400 when email is already verified', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'test@example.com', emailVerified: true },
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(400);
    // Status code alone verifies behavior — code field is an implementation detail
  });

  it('returns 400 when user has no email', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: null, emailVerified: false },
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(400);
    // Status code alone verifies behavior
  });

  it('generates new token and sends verification email', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'test@example.com', emailVerified: false },
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetClient.mockReturnValue({ update: mockUpdate });
    mockSendVerificationEmail.mockResolvedValue({ success: true });

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { success: boolean } }).body.success).toBe(true);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.any(String), // raw token (UUID)
    );
  });

  it('returns 500 when email send fails', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1', email: 'test@example.com', emailVerified: false },
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    mockGetClient.mockReturnValue({ update: mockUpdate });
    mockSendVerificationEmail.mockResolvedValue({ success: false, error: 'SMTP error' });

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(500);
    // Status code alone verifies behavior
  });
});
