/**
 * Tests for DELETE /api/auth/sessions/[sessionId]
 *
 * Session revocation: prevents revoking current session,
 * enforces ownership via userId filter, soft-deletes.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockGetClient = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@revealui/db', () => ({
  getClient: () => mockGetClient(),
}));

vi.mock('@revealui/db/schema', () => ({
  sessions: { id: 'id', userId: 'userId', deletedAt: 'deletedAt' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
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

function makeRequest() {
  return { headers: { get: () => null } } as never;
}

describe('DELETE /api/auth/sessions/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../sessions/[sessionId]/route.js');
    return mod.DELETE;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const DELETE = await loadRoute();
    const res = await DELETE(makeRequest(), { params: Promise.resolve({ sessionId: 's1' }) });
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 400 when trying to revoke current session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { id: 'current-session' },
    });
    const DELETE = await loadRoute();
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'current-session' }),
    });
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 404 when session not found or not owned', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { id: 'current-session' },
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ update: mockUpdate });

    const DELETE = await loadRoute();
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'other-session' }),
    });
    expect((res as { status: number }).status).toBe(404);
  });

  it('soft-deletes session and returns 200', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u1' },
      session: { id: 'current-session' },
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'target-session' }]),
        }),
      }),
    });
    mockGetClient.mockReturnValue({ update: mockUpdate });

    const DELETE = await loadRoute();
    const res = await DELETE(makeRequest(), {
      params: Promise.resolve({ sessionId: 'target-session' }),
    });
    expect((res as { status: number }).status).toBe(200);
  });
});
