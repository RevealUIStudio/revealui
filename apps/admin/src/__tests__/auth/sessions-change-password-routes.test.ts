/**
 * Sessions & Change-Password Route Tests
 *
 * GET    /api/auth/sessions               -  list active sessions, mark current
 * DELETE /api/auth/sessions/[sessionId]   -  revoke a session (own sessions only)
 * POST   /api/auth/change-password        -  change user password with validation
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must be declared before route imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  changePassword: vi.fn(),
  deleteOtherUserSessions: vi.fn(),
  meetsMinimumPasswordRequirements: vi.fn(),
  validatePasswordStrength: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: unknown) => handler),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: vi.fn(() => ({ userAgent: 'test', ipAddress: '127.0.0.1' })),
}));

// Drizzle ORM helpers  -  used for query predicates; return value is irrelevant
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ _op: 'and', args })),
  eq: vi.fn((col: unknown, val: unknown) => ({ _op: 'eq', col, val })),
  gt: vi.fn((col: unknown, val: unknown) => ({ _op: 'gt', col, val })),
  isNull: vi.fn((col: unknown) => ({ _op: 'isNull', col })),
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
}));

// ── Drizzle client mock ───────────────────────────────────────────────────────
//
// The sessions routes use two query shapes:
//
//   SELECT: db.select({...}).from(t).where(pred).orderBy(col)  → row[]
//   UPDATE: db.update(t).set({...}).where(pred).returning()    → row[]
//
// Each mock factory returns a chainable object whose terminal method resolves
// to the caller's chosen result value.

function makeSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(result);
  return { select: vi.fn().mockReturnValue(chain), chain };
}

function makeUpdateChain(result: unknown[]) {
  const chain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
  };
  chain.set.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.returning.mockResolvedValue(result);
  return { update: vi.fn().mockReturnValue(chain), chain };
}

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  changePassword,
  deleteOtherUserSessions,
  getSession,
  meetsMinimumPasswordRequirements,
  validatePasswordStrength,
} from '@revealui/auth/server';
import { getClient } from '@revealui/db';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-22T09:00:00.000Z');
const FUTURE = new Date('2026-03-23T09:00:00.000Z');

const mockUserSession = {
  session: {
    id: 'session-current',
    userId: 'user-abc',
    tokenHash: 'hash',
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    persistent: false,
    lastActivityAt: NOW,
    createdAt: NOW,
    expiresAt: FUTURE,
    schemaVersion: '1',
  },
  user: {
    id: 'user-abc',
    email: 'alice@test.com',
    name: 'Alice',
    role: 'user',
    status: 'active',
    password: 'hashed',
    emailVerified: true,
    schemaVersion: '1',
  },
};

function makeRequest(url = 'http://localhost/api/auth/sessions'): NextRequest {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// GET /api/auth/sessions
// ---------------------------------------------------------------------------

describe('GET /api/auth/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockUserSession as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { GET } = await import('../../app/api/auth/sessions/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with sessions list', async () => {
    const sessionRow = {
      id: 'session-other',
      userAgent: 'Safari/537',
      ipAddress: '10.0.0.1',
      persistent: true,
      lastActivityAt: NOW,
      createdAt: NOW,
      expiresAt: FUTURE,
    };
    const { select } = makeSelectChain([sessionRow]);
    vi.mocked(getClient).mockReturnValue({ select } as never);

    const { GET } = await import('../../app/api/auth/sessions/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
    expect(body.currentSessionId).toBe('session-current');
  });

  it('marks the calling session as isCurrent: true', async () => {
    const currentRow = {
      id: 'session-current',
      userAgent: 'Chrome/120',
      ipAddress: '127.0.0.1',
      persistent: false,
      lastActivityAt: NOW,
      createdAt: NOW,
      expiresAt: FUTURE,
    };
    const otherRow = { ...currentRow, id: 'session-other' };
    const { select } = makeSelectChain([currentRow, otherRow]);
    vi.mocked(getClient).mockReturnValue({ select } as never);

    const { GET } = await import('../../app/api/auth/sessions/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    const current = body.sessions.find((s: { id: string }) => s.id === 'session-current');
    const other = body.sessions.find((s: { id: string }) => s.id === 'session-other');
    expect(current?.isCurrent).toBe(true);
    expect(other?.isCurrent).toBe(false);
  });

  it('serialises dates to ISO strings', async () => {
    const row = {
      id: 'session-x',
      userAgent: null,
      ipAddress: null,
      persistent: false,
      lastActivityAt: NOW,
      createdAt: NOW,
      expiresAt: FUTURE,
    };
    const { select } = makeSelectChain([row]);
    vi.mocked(getClient).mockReturnValue({ select } as never);

    const { GET } = await import('../../app/api/auth/sessions/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    const s = body.sessions[0];
    expect(typeof s.lastActivityAt).toBe('string');
    expect(typeof s.createdAt).toBe('string');
    expect(typeof s.expiresAt).toBe('string');
    // Valid ISO strings
    expect(() => new Date(s.lastActivityAt)).not.toThrow();
  });

  it('returns 500 when the database throws', async () => {
    const chain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockRejectedValue(new Error('DB down'));
    vi.mocked(getClient).mockReturnValue({ select: vi.fn().mockReturnValue(chain) } as never);

    const { GET } = await import('../../app/api/auth/sessions/route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/sessions/[sessionId]
// ---------------------------------------------------------------------------

describe('DELETE /api/auth/sessions/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockUserSession as never);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { DELETE } = await import('../../app/api/auth/sessions/[sessionId]/route');
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'session-other' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when trying to revoke the current session', async () => {
    const { DELETE } = await import('../../app/api/auth/sessions/[sessionId]/route');
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'session-current' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/current session|sign out/i);
  });

  it('returns 404 when session not found or belongs to another user', async () => {
    const { update } = makeUpdateChain([]); // empty returning = not found
    vi.mocked(getClient).mockReturnValue({ update } as never);

    const { DELETE } = await import('../../app/api/auth/sessions/[sessionId]/route');
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'session-other' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 when session is revoked successfully', async () => {
    const { update } = makeUpdateChain([{ id: 'session-other', deletedAt: NOW }]);
    vi.mocked(getClient).mockReturnValue({ update } as never);

    const { DELETE } = await import('../../app/api/auth/sessions/[sessionId]/route');
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'session-other' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/revoked/i);
  });

  it('soft-deletes by setting deletedAt (does not hard-delete)', async () => {
    const mockChain = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn().mockResolvedValue([{ id: 'session-other' }]),
    };
    mockChain.set.mockReturnValue(mockChain);
    mockChain.where.mockReturnValue(mockChain);
    const mockUpdate = vi.fn().mockReturnValue(mockChain);
    vi.mocked(getClient).mockReturnValue({ update: mockUpdate } as never);

    const { DELETE } = await import('../../app/api/auth/sessions/[sessionId]/route');
    await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'session-other' }),
    });

    // update() called (soft delete), not delete()
    expect(mockUpdate).toHaveBeenCalled();
    // set() called with a deletedAt field
    expect(mockChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });

  it('returns 500 when database throws', async () => {
    const mockChain = {
      set: vi.fn(),
      where: vi.fn(),
      returning: vi.fn().mockRejectedValue(new Error('DB error')),
    };
    mockChain.set.mockReturnValue(mockChain);
    mockChain.where.mockReturnValue(mockChain);
    vi.mocked(getClient).mockReturnValue({
      update: vi.fn().mockReturnValue(mockChain),
    } as never);

    const { DELETE } = await import('../../app/api/auth/sessions/[sessionId]/route');
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'session-other' }),
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/change-password
// ---------------------------------------------------------------------------

describe('POST /api/auth/change-password', () => {
  function makeChangePasswordRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/auth/change-password', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockUserSession as never);
    vi.mocked(meetsMinimumPasswordRequirements).mockReturnValue(true);
    vi.mocked(validatePasswordStrength).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(changePassword).mockResolvedValue({ success: true });
    vi.mocked(deleteOtherUserSessions).mockResolvedValue(undefined);
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'old', newPassword: 'NewPass1' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(makeChangePasswordRequest('not-json'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when currentPassword is missing', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(makeChangePasswordRequest({ newPassword: 'NewPass1!' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is missing', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(makeChangePasswordRequest({ currentPassword: 'OldPass1!' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when newPassword is shorter than 8 characters', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'OldPass1!', newPassword: 'short' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when new password fails strength requirements', async () => {
    vi.mocked(validatePasswordStrength).mockReturnValue({
      valid: false,
      errors: ['Password does not meet strength requirements.'],
    });
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'OldPass1!', newPassword: 'alllowercase1' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when current password is incorrect', async () => {
    vi.mocked(changePassword).mockResolvedValue({
      success: false,
      error: 'Current password is incorrect.',
    });
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'wrong', newPassword: 'NewPass1!' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/incorrect/i);
  });

  it('returns 400 when user has no password set (OAuth-only account)', async () => {
    vi.mocked(changePassword).mockResolvedValue({
      success: false,
      error: 'No password is set for this account.',
    });
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'anything', newPassword: 'NewPass1!' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/no password/i);
  });

  it('returns 404 when user record is not found', async () => {
    vi.mocked(changePassword).mockResolvedValue({
      success: false,
      error: 'User not found.',
    });
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'old', newPassword: 'NewPass1!' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful password change', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/password updated/i);
  });

  it('passes session ID to changePassword for session revocation', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    await POST(
      makeChangePasswordRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }),
    );
    expect(changePassword).toHaveBeenCalledWith(
      'user-abc',
      'OldPass1!',
      'NewPass1!',
      'session-current',
    );
  });

  it('passes session ID when revokeOtherSessions is true', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    await POST(
      makeChangePasswordRequest({
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
        revokeOtherSessions: true,
      }),
    );
    expect(changePassword).toHaveBeenCalledWith(
      'user-abc',
      'OldPass1!',
      'NewPass1!',
      'session-current',
    );
  });

  it('does not revoke sessions when revokeOtherSessions is false', async () => {
    const { POST } = await import('../../app/api/auth/change-password/route');
    await POST(
      makeChangePasswordRequest({
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
        revokeOtherSessions: false,
      }),
    );
    expect(deleteOtherUserSessions).not.toHaveBeenCalled();
  });

  it('returns 500 when changePassword throws unexpectedly', async () => {
    vi.mocked(changePassword).mockRejectedValue(new Error('unexpected DB error'));
    const { POST } = await import('../../app/api/auth/change-password/route');
    const res = await POST(
      makeChangePasswordRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }),
    );
    expect(res.status).toBe(500);
  });
});
