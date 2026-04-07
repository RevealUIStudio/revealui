/**
 * Tests for POST /api/capture-error
 *
 * Client error capture proxy — forwards error reports to upstream API
 * with server-side X-Internal-Token header injection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock('@revealui/config', () => ({
  default: {
    reveal: {
      get secret() {
        return process.env.REVEALUI_SECRET ?? '';
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

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

describe('POST /api/capture-error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = 'test-internal-secret';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test.com';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  async function loadRoute() {
    const mod = await import('../route.js');
    return mod.POST;
  }

  it('returns 202 silently when REVEALUI_SECRET is not set', async () => {
    delete process.env.REVEALUI_SECRET;
    const POST = await loadRoute();
    const req = { text: () => Promise.resolve('{}') } as never;
    const res = await POST(req);

    expect((res as { status: number }).status).toBe(202);
    expect((res as unknown as { body: { success: boolean } }).body.success).toBe(true);
  });

  it('returns 400 when request body is unreadable', async () => {
    const POST = await loadRoute();
    const req = { text: () => Promise.reject(new Error('stream error')) } as never;
    const res = await POST(req);

    expect((res as { status: number }).status).toBe(400);
  });

  it('proxies error report to upstream with X-Internal-Token header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ received: true }),
    });
    globalThis.fetch = mockFetch;

    const POST = await loadRoute();
    const req = { text: () => Promise.resolve('{"error":"test"}') } as never;
    const res = await POST(req);

    expect((res as { status: number }).status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.test.com/api/errors',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Internal-Token': 'test-internal-secret',
          'Content-Type': 'application/json',
        }),
        body: '{"error":"test"}',
      }),
    );
  });

  it('returns 202 when upstream is unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const POST = await loadRoute();
    const req = { text: () => Promise.resolve('{}') } as never;
    const res = await POST(req);

    // Should silently accept — never break the error UI
    expect((res as { status: number }).status).toBe(202);
    expect((res as unknown as { body: { success: boolean } }).body.success).toBe(true);
  });

  it('forwards upstream status code on error responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 429,
      json: () => Promise.resolve({ error: 'Rate limited' }),
    });

    const POST = await loadRoute();
    const req = { text: () => Promise.resolve('{}') } as never;
    const res = await POST(req);

    expect((res as { status: number }).status).toBe(429);
  });
});
