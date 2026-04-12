/**
 * Tests for health and diagnostic routes:
 * - GET /api/health (enhanced health check  -  minimal for unauth, full for admin)
 * - HEAD /api/health (liveness probe)
 * - GET /api/health/live (liveness probe)
 * - GET /api/health/ready (readiness probe)
 * - GET /api/ping (minimal diagnostic  -  zero external imports)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockGetRevealUIInstance = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utilities/revealui-singleton', () => ({
  getRevealUIInstance: (...args: unknown[]) => mockGetRevealUIInstance(...args),
}));

vi.mock('@vercel/blob', () => ({
  list: vi.fn(),
}));

vi.mock('@revealui/config', () => ({
  default: {
    stripe: {
      get secretKey() {
        return process.env.STRIPE_SECRET_KEY;
      },
    },
    storage: {
      get blobToken() {
        return process.env.BLOB_READ_WRITE_TOKEN;
      },
    },
  },
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

// ─── GET /api/health ────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no Stripe/Blob keys are set by default
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  async function loadRoute() {
    const mod = await import('../route.js');
    return { GET: mod.GET, HEAD: mod.HEAD };
  }

  it('returns minimal status for unauthenticated requests', async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await loadRoute();
    const res = await GET({ headers: { get: () => null } } as never);

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { status: string } }).body.status).toBe('healthy');
    // Should NOT contain detailed checks or metrics
    expect((res as unknown as { body: Record<string, unknown> }).body).not.toHaveProperty('checks');
    expect((res as unknown as { body: Record<string, unknown> }).body).not.toHaveProperty(
      'metrics',
    );
  });

  it('returns minimal status for non-admin authenticated users', async () => {
    mockGetSession.mockResolvedValue({ user: { role: 'user' } });
    const { GET } = await loadRoute();
    const res = await GET({ headers: { get: () => null } } as never);

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: Record<string, unknown> }).body).not.toHaveProperty('checks');
  });

  it('returns full health details for admin users', async () => {
    mockGetSession.mockResolvedValue({ user: { role: 'admin' } });
    const mockFind = vi.fn().mockResolvedValue({ docs: [] });
    mockGetRevealUIInstance.mockResolvedValue({ find: mockFind });

    const { GET } = await loadRoute();
    const res = await GET({ headers: { get: () => null } } as never);

    expect((res as { status: number }).status).toBe(200);
    const body = (res as unknown as { body: Record<string, unknown> }).body;
    expect(body).toHaveProperty('checks');
    expect(body).toHaveProperty('metrics');
    expect(body.service).toBe('RevealUI Admin');
  });

  it('returns 503 when database is unhealthy', async () => {
    mockGetSession.mockResolvedValue({ user: { role: 'admin' } });
    mockGetRevealUIInstance.mockRejectedValue(new Error('Connection refused'));

    const { GET } = await loadRoute();
    const res = await GET({ headers: { get: () => null } } as never);

    expect((res as { status: number }).status).toBe(503);
    const body = (
      res as unknown as {
        body: { status: string; checks: Array<{ name: string; status: string }> };
      }
    ).body;
    expect(body.status).toBe('unhealthy');
    expect(body.checks.find((c) => c.name === 'database')?.status).toBe('unhealthy');
  });

  it('HEAD returns 200 with no body', async () => {
    const { HEAD } = await loadRoute();
    const res = await HEAD();
    expect((res as { status: number }).status).toBe(200);
  });
});

// ─── GET /api/health/live ───────────────────────────────────────────────────

describe('GET /api/health/live', () => {
  it('always returns 200 with alive status', async () => {
    const mod = await import('../live/route.js');
    const res = await mod.GET();

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { status: string } }).body.status).toBe('alive');
    expect((res as unknown as { body: { timestamp: string } }).body.timestamp).toBeTruthy();
  });
});

// ─── GET /api/health/ready ──────────────────────────────────────────────────

describe('GET /api/health/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../ready/route.js');
    return mod.GET;
  }

  it('returns 200 when database is accessible', async () => {
    mockGetRevealUIInstance.mockResolvedValue({
      find: vi.fn().mockResolvedValue({ docs: [] }),
    });

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { status: string } }).body.status).toBe('ready');
  });

  it('returns 503 when database is unreachable', async () => {
    mockGetRevealUIInstance.mockRejectedValue(new Error('Connection timeout'));

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(503);
    expect((res as unknown as { body: { status: string } }).body.status).toBe('not-ready');
    expect((res as unknown as { body: { error: string } }).body.error).toBe('Connection timeout');
  });
});

// ─── GET /api/ping ──────────────────────────────────────────────────────────

describe('GET /api/ping', () => {
  it('returns ok with node version and env status', async () => {
    const mod = await import('../../ping/route.js');
    const res = await mod.GET();

    // ping uses raw Response.json, not NextResponse
    // The response is a standard Response object
    const body = await (res as Response).json();
    expect(body.ok).toBe(true);
    expect(body.node).toBe(process.version);
    expect(body.env).toHaveProperty('NODE_ENV');
  });
});
