import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

describe('GET /api/health/electric', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ELECTRIC_SERVICE_URL = 'http://electric.test';
    delete process.env.ELECTRIC_SECRET;
  });

  afterEach(() => {
    delete process.env.ELECTRIC_SERVICE_URL;
    delete process.env.ELECTRIC_URL;
    delete process.env.ELECTRIC_SECRET;
  });

  async function loadRoute() {
    const mod = await import('../route.js');
    return mod.GET;
  }

  it('returns ok:true with latencyMs on 200 from Electric', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', version: '1.2.3' }),
    });

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(200);
    const body = (
      res as unknown as { body: { ok: boolean; latencyMs: number; electricVersion: string } }
    ).body;
    expect(body.ok).toBe(true);
    expect(typeof body.latencyMs).toBe('number');
    expect(body.electricVersion).toBe('1.2.3');
  });

  it('returns ok:true without electricVersion when body has no version field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(200);
    const body = (res as unknown as { body: { ok: boolean; electricVersion?: string } }).body;
    expect(body.ok).toBe(true);
    expect(body.electricVersion).toBeUndefined();
  });

  it('returns ok:false with 503 when Electric responds non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
    });

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(503);
    const body = (res as unknown as { body: { ok: boolean; error: string; latencyMs: number } })
      .body;
    expect(body.ok).toBe(false);
    expect(body.error).toContain('502');
    expect(typeof body.latencyMs).toBe('number');
  });

  it('returns ok:false with 503 on AbortError (timeout)', async () => {
    const abortError = Object.assign(
      new DOMException('The operation was aborted.', 'TimeoutError'),
    );
    mockFetch.mockRejectedValueOnce(abortError);

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(503);
    const body = (res as unknown as { body: { ok: boolean; error: string } }).body;
    expect(body.ok).toBe(false);
    expect(body.error).toContain('timed out');
  });

  it('returns ok:false with 503 on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(503);
    const body = (res as unknown as { body: { ok: boolean; error: string } }).body;
    expect(body.ok).toBe(false);
  });

  it('returns ok:false with 503 when ELECTRIC_SERVICE_URL is not set', async () => {
    delete process.env.ELECTRIC_SERVICE_URL;
    delete process.env.ELECTRIC_URL;

    const GET = await loadRoute();
    const res = await GET();

    expect((res as { status: number }).status).toBe(503);
    const body = (res as unknown as { body: { ok: boolean; error: string } }).body;
    expect(body.ok).toBe(false);
    expect(body.error).toContain('not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends Authorization header when ELECTRIC_SECRET is set', async () => {
    process.env.ELECTRIC_SECRET = 'super-secret';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const GET = await loadRoute();
    await GET();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://electric.test/v1/health',
      expect.objectContaining({
        headers: { Authorization: 'Bearer super-secret' },
      }),
    );
  });

  it('omits Authorization header when ELECTRIC_SECRET is not set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const GET = await loadRoute();
    await GET();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://electric.test/v1/health',
      expect.objectContaining({
        headers: {},
      }),
    );
  });
});
