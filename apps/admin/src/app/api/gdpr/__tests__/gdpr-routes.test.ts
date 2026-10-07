/**
 * Tests for GDPR routes:
 * - POST /api/gdpr/delete (cascade delete with audit)
 * - POST /api/gdpr/export (data export with size guard)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockCheckSessionMfa = vi.fn((..._args: unknown[]) => ({ allowed: true }));
const mockGetRevealUIInstance = vi.fn();
const mockWriteGDPRAuditEntry = vi.fn();
const mockAssertDomainCleanupComplete = vi.fn().mockResolvedValue(undefined);
let cleanupAdmissionActive = false;
vi.mock('@revealui/db/queries/users', () => ({
  withUserDomainCleanupAdmission: async (
    db: unknown,
    userId: string,
    erase: () => Promise<unknown>,
  ) => {
    await mockAssertDomainCleanupComplete(db, userId);
    cleanupAdmissionActive = true;
    try {
      return await erase();
    } finally {
      cleanupAdmissionActive = false;
    }
  },
}));

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  // C11 requireSessionWithMfa on account_delete: allow gate by default.
  checkSessionMfa: (...args: unknown[]) => mockCheckSessionMfa(...args),
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
  };
});

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown, _opts?: unknown) => handler,
}));

vi.mock('@/lib/utils/revealui-singleton', () => ({
  getRevealUIInstance: (...args: unknown[]) => mockGetRevealUIInstance(...args),
}));

vi.mock('@/lib/utils/gdpr-audit', () => ({
  writeGDPRAuditEntry: (...args: unknown[]) => mockWriteGDPRAuditEntry(...args),
}));

// Mock @revealui/db so getClient() doesn't attempt a real database connection.
// The GDPR delete route calls db.delete(appLogs/errorEvents) (blocking SQL
// cascade) and db.select().from(users) (Stripe customer ID lookup) — both
// must resolve cleanly for the success-path tests to pass.
vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  })),
}));

vi.mock('next/server', () => {
  class MockNextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockNextResponse(data, init);
    }
  }
  return { NextResponse: MockNextResponse };
});

function makeRequest() {
  return {
    headers: { get: () => null },
  } as never;
}

// ─── POST /api/gdpr/delete ──────────────────────────────────────────────────

describe('POST /api/gdpr/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertDomainCleanupComplete.mockResolvedValue(undefined);
    cleanupAdmissionActive = false;
  });

  async function loadRoute() {
    const mod = await import('../delete/route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns actionable cleanup conflict before account erasure side effects', async () => {
    const { SiteDomainCleanupRequiredError } = await import('@revealui/db/queries/sites');
    mockGetSession.mockResolvedValue({ user: { id: 'operator', email: 'operator@customer.com' } });
    mockAssertDomainCleanupComplete.mockRejectedValueOnce(
      new SiteDomainCleanupRequiredError(
        undefined,
        'Detach owned consultation hostnames before deleting this account.',
      ),
    );
    const POST = await loadRoute();
    const result = await POST(makeRequest());
    expect((result as { status: number }).status).toBe(409);
    expect(await result.json()).toEqual({
      error: 'Detach owned consultation hostnames before deleting this account.',
      code: 'SITE_DOMAIN_CLEANUP_REQUIRED',
    });
    expect(mockGetRevealUIInstance).not.toHaveBeenCalled();
    expect(mockWriteGDPRAuditEntry).not.toHaveBeenCalled();
  });

  it('cascade deletes user data and writes audit entry', async () => {
    const mockFind = vi.fn().mockResolvedValue({ docs: [] });
    const mockDelete = vi.fn().mockResolvedValue({});
    const revealui = { find: mockFind, delete: mockDelete };

    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockGetRevealUIInstance.mockResolvedValue(revealui);
    mockWriteGDPRAuditEntry.mockResolvedValue(undefined);

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { success: boolean } }).body.success).toBe(true);

    // Should delete user record after cascade
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 'user-1' }),
    );

    // Should write audit entry
    expect(mockWriteGDPRAuditEntry).toHaveBeenCalledWith(
      revealui,
      expect.objectContaining({
        action: 'delete',
        userId: 'user-1',
        requestedBy: 'test@example.com',
      }),
    );
  });

  it('holds cleanup admission through final CMS deletion', async () => {
    let releaseUserDeletion: () => void = () => {};
    const userDeleted = new Promise<void>((resolve) => {
      releaseUserDeletion = resolve;
    });
    const mockDelete = vi.fn(async () => {
      expect(cleanupAdmissionActive).toBe(true);
      await userDeleted;
    });
    const revealui = {
      find: vi.fn(async () => {
        expect(cleanupAdmissionActive).toBe(true);
        return { docs: [] };
      }),
      delete: mockDelete,
    };
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
    mockGetRevealUIInstance.mockResolvedValue(revealui);
    mockWriteGDPRAuditEntry.mockImplementation(async () => {
      expect(cleanupAdmissionActive).toBe(true);
    });
    const POST = await loadRoute();
    const response = POST(makeRequest());
    try {
      await vi.waitFor(() =>
        expect(mockDelete).toHaveBeenCalledWith({ collection: 'users', id: 'user-1' }),
      );
      expect(cleanupAdmissionActive).toBe(true);
    } finally {
      releaseUserDeletion();
    }
    expect((await response).status).toBe(200);
    expect(cleanupAdmissionActive).toBe(false);
  });

  it('bounds Sentry erasure without following redirects while admission remains held', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetchSentry = vi.fn((_url: string, options: RequestInit) => {
      expect(cleanupAdmissionActive).toBe(true);
      return new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new Error('Sentry deadline exceeded')),
          {
            once: true,
          },
        );
      });
    });
    vi.stubGlobal('fetch', fetchSentry);
    vi.stubEnv('SENTRY_AUTH_TOKEN', 'synthetic-token');
    vi.stubEnv('SENTRY_ORG', 'test-org');
    vi.stubEnv('SENTRY_PROJECT', 'test-project');
    const mockDelete = vi.fn().mockResolvedValue({});
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });
    mockGetRevealUIInstance.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      delete: mockDelete,
    });
    mockWriteGDPRAuditEntry.mockResolvedValue(undefined);
    const POST = await loadRoute();
    const response = POST(makeRequest());
    try {
      await vi.waitFor(() => expect(fetchSentry).toHaveBeenCalledOnce());
      expect(timeout).toHaveBeenCalledWith(10_000);
      expect(fetchSentry).toHaveBeenCalledWith(
        expect.stringContaining('/test-org/test-project/users/'),
        expect.objectContaining({ redirect: 'error', signal: controller.signal }),
      );
      expect(cleanupAdmissionActive).toBe(true);
      expect(mockDelete).not.toHaveBeenCalled();
      controller.abort();
      // Remote cleanup failure retains the existing nonblocking policy; its
      // persistent retry/completion debt is separately inventoried.
      expect((await response).status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith({ collection: 'users', id: 'user-1' });
      expect(cleanupAdmissionActive).toBe(false);
    } finally {
      controller.abort();
      await response;
      timeout.mockRestore();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('deletes documents in batches when user has many records', async () => {
    const mockFind = vi
      .fn()
      // First call for conversations: returns 2 docs
      .mockResolvedValueOnce({ docs: [{ id: 'c1' }, { id: 'c2' }] })
      // Second call for conversations: empty (done)
      .mockResolvedValueOnce({ docs: [] })
      // Remaining collections: empty
      .mockResolvedValue({ docs: [] });
    const mockDelete = vi.fn().mockResolvedValue({});
    const revealui = { find: mockFind, delete: mockDelete };

    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockGetRevealUIInstance.mockResolvedValue(revealui);
    mockWriteGDPRAuditEntry.mockResolvedValue(undefined);

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    // 2 conversation docs + 1 user doc
    expect(mockDelete).toHaveBeenCalledTimes(3);
  });

  it('aborts user deletion when cascade fails', async () => {
    const mockFind = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockDelete = vi.fn();
    const revealui = { find: mockFind, delete: mockDelete };

    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
    });
    mockGetRevealUIInstance.mockResolvedValue(revealui);
    mockWriteGDPRAuditEntry.mockResolvedValue(undefined);

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(500);
    expect((res as unknown as { body: { success: boolean } }).body.success).toBe(false);
    // User record should NOT be deleted when cascade fails
    expect(mockDelete).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'users' }));
    // Audit entry should record the abort
    expect(mockWriteGDPRAuditEntry).toHaveBeenCalledWith(
      revealui,
      expect.objectContaining({ metadata: expect.objectContaining({ aborted: true }) }),
    );
    expect(cleanupAdmissionActive).toBe(false);
  });
});

// ─── POST /api/gdpr/export ──────────────────────────────────────────────────

describe('POST /api/gdpr/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../export/route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest());
    expect((res as { status: number }).status).toBe(401);
  });

  it('exports user data with all collections', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'user',
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-03-25',
      },
    });

    const mockFind = vi.fn().mockResolvedValue({ docs: [{ id: 'doc-1' }] });
    mockGetRevealUIInstance.mockResolvedValue({ find: mockFind });
    mockWriteGDPRAuditEntry.mockResolvedValue(undefined);

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    const body = (res as unknown as { body: Record<string, unknown> }).body;
    expect(body).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({ id: 'user-1' }),
          conversations: [{ id: 'doc-1' }],
          orders: [{ id: 'doc-1' }],
          subscriptions: [{ id: 'doc-1' }],
        }),
        format: 'json',
      }),
    );

    // Should set Content-Disposition header for download
    expect(
      (res as unknown as { headers: Map<string, string> }).headers.get('Content-Disposition'),
    ).toContain('user-data-user-1.json');

    // Should write audit entry
    expect(mockWriteGDPRAuditEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'export', userId: 'user-1' }),
    );
  });

  it('handles partial collection failures gracefully', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'user',
        status: 'active',
      },
    });

    const mockFind = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 'conv-1' }] }) // conversations OK
      .mockRejectedValueOnce(new Error('orders table down')) // orders fail
      .mockResolvedValueOnce({ docs: [] }); // subscriptions OK
    mockGetRevealUIInstance.mockResolvedValue({ find: mockFind });
    mockWriteGDPRAuditEntry.mockResolvedValue(undefined);

    const POST = await loadRoute();
    const res = await POST(makeRequest());

    expect((res as { status: number }).status).toBe(200);
    const body = (res as unknown as { body: Record<string, unknown> }).body;
    const data = (body as { data: { conversations: unknown[]; orders: unknown[] } }).data;
    expect(data.conversations).toHaveLength(1);
    expect(data.orders).toEqual([]); // Graceful fallback
  });
});
