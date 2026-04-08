/**
 * GDPR API Unit Tests
 *
 * Tests the GDPR export and delete route handlers in isolation by mocking
 * all external dependencies (RevealUI instance, session, rate limiter).
 * This avoids the Next.js database-initialization hang that affected the
 * original integration test approach.
 */

import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module-level mocks (hoisted before any imports) ─────────────────────────

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/utilities/revealui-singleton', () => ({
  getRevealUIInstance: vi.fn(),
}));

vi.mock('@/lib/utilities/gdpr-audit', () => ({
  writeGDPRAuditEntry: vi.fn(),
}));

// withRateLimit is a passthrough in tests — just call the handler directly
vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: unknown) => handler),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { getSession } from '@revealui/auth/server';
import { writeGDPRAuditEntry } from '@/lib/utilities/gdpr-audit';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

// biome-ignore lint/suspicious/noExplicitAny: test mock does not need strict typing
function makeMockRevealUI(overrides: Record<string, any> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GDPR Export — POST /api/gdpr/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(getRevealUIInstance).mockResolvedValue(makeMockRevealUI() as never);
    vi.mocked(writeGDPRAuditEntry).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { POST } = await import('../../../app/api/gdpr/export/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data and collections on success', async () => {
    const conversations = [{ id: 'conv-1', message: 'hello' }];
    const orders = [{ id: 'order-1', amount: 100 }];
    vi.mocked(getRevealUIInstance).mockResolvedValue(
      makeMockRevealUI({
        find: vi
          .fn()
          .mockResolvedValueOnce({ docs: conversations })
          .mockResolvedValueOnce({ docs: orders })
          .mockResolvedValueOnce({ docs: [] }),
      }) as never,
    );

    const { POST } = await import('../../../app/api/gdpr/export/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.user.id).toBe('user-123');
    expect(body.data.user.email).toBe('test@example.com');
    expect(body.data.conversations).toEqual(conversations);
    expect(body.data.orders).toEqual(orders);
    expect(body.exportedAt).toBeDefined();
  });

  it('includes partial data when some collections fail', async () => {
    const orders = [{ id: 'order-1' }];
    vi.mocked(getRevealUIInstance).mockResolvedValue(
      makeMockRevealUI({
        find: vi
          .fn()
          .mockRejectedValueOnce(new Error('conversations DB error'))
          .mockResolvedValueOnce({ docs: orders })
          .mockResolvedValueOnce({ docs: [] }),
      }) as never,
    );

    const { POST } = await import('../../../app/api/gdpr/export/route');
    const res = await POST(makeRequest({}));
    // Partial failures are non-fatal — endpoint still returns 200 with available data
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.orders).toEqual(orders);
    expect(body.data.conversations).toEqual([]);
  });

  it('sets Content-Disposition header for download', async () => {
    const { POST } = await import('../../../app/api/gdpr/export/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    expect(res.headers.get('Content-Disposition')).toContain('user-123');
  });

  it('does not include password or sensitive fields in export', async () => {
    const { POST } = await import('../../../app/api/gdpr/export/route');
    const res = await POST(makeRequest({}));
    const body = await res.json();
    expect(body.data.user).not.toHaveProperty('password');
    expect(body.data.user).not.toHaveProperty('passwordHash');
  });
});

describe('GDPR Delete — POST /api/gdpr/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockSession as never);
    vi.mocked(getRevealUIInstance).mockResolvedValue(makeMockRevealUI() as never);
    vi.mocked(writeGDPRAuditEntry).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { POST } = await import('../../../app/api/gdpr/delete/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it('deletes user and all related collections on success', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockFind = vi
      .fn()
      // conversations: one page then empty
      .mockResolvedValueOnce({ docs: [{ id: 'conv-1' }] })
      .mockResolvedValueOnce({ docs: [] })
      // orders: empty
      .mockResolvedValueOnce({ docs: [] })
      // subscriptions: empty
      .mockResolvedValueOnce({ docs: [] })
      // events: empty
      .mockResolvedValueOnce({ docs: [] });

    vi.mocked(getRevealUIInstance).mockResolvedValue(
      makeMockRevealUI({ find: mockFind, delete: mockDelete }) as never,
    );

    const { POST } = await import('../../../app/api/gdpr/delete/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.deletedAt).toBeDefined();

    // Conversation doc + user record deleted
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'conversations', id: 'conv-1' }),
    );
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 'user-123' }),
    );
  });

  it('returns 500 and preserves user record if cascade partially fails', async () => {
    vi.mocked(getRevealUIInstance).mockResolvedValue(
      makeMockRevealUI({
        find: vi
          .fn()
          .mockRejectedValueOnce(new Error('conversations collection unavailable'))
          .mockResolvedValueOnce({ docs: [] }) // orders
          .mockResolvedValueOnce({ docs: [] }) // subscriptions
          .mockResolvedValueOnce({ docs: [] }), // events
      }) as never,
    );

    const { POST } = await import('../../../app/api/gdpr/delete/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Cascade deletion partially failed');
  });

  it('deletes all records when user has many docs (pagination)', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `conv-${i}` }));
    const page2 = [{ id: 'conv-100' }];

    const mockFind = vi
      .fn()
      // conversations: 2 pages, then empty
      .mockResolvedValueOnce({ docs: page1 })
      .mockResolvedValueOnce({ docs: page2 })
      .mockResolvedValueOnce({ docs: [] })
      // orders, subscriptions, events: empty
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });

    vi.mocked(getRevealUIInstance).mockResolvedValue(
      makeMockRevealUI({ find: mockFind, delete: mockDelete }) as never,
    );

    const { POST } = await import('../../../app/api/gdpr/delete/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(200);

    // 101 conversation docs + 1 user record
    expect(mockDelete).toHaveBeenCalledTimes(102);
  });

  it('writes an audit entry on successful deletion', async () => {
    const { POST } = await import('../../../app/api/gdpr/delete/route');
    await POST(makeRequest({}));

    expect(writeGDPRAuditEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'delete',
        userId: 'user-123',
      }),
    );
  });

  it('writes an audit entry even when cascade fails', async () => {
    vi.mocked(getRevealUIInstance).mockResolvedValue(
      makeMockRevealUI({
        find: vi.fn().mockRejectedValue(new Error('DB error')),
      }) as never,
    );

    const { POST } = await import('../../../app/api/gdpr/delete/route');
    await POST(makeRequest({}));

    expect(writeGDPRAuditEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'delete',
        metadata: expect.objectContaining({ aborted: true }),
      }),
    );
  });
});
