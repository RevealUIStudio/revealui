/**
 * Ping & Capture-Error Route Tests
 *
 * GET  /api/ping              — minimal diagnostic probe
 * POST /api/capture-error     — client-error proxy (adds X-Internal-Token server-side)
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be defined before route imports
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '../../app/api/capture-error/route';
import { GET } from '../../app/api/ping/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECRET = 'test-secret-key-for-testing-only-32chars';

function makeRequest(body: string): NextRequest {
  return new NextRequest('http://localhost/api/capture-error', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockUpstream(status: number, data: unknown, ok = status < 400): void {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

// ---------------------------------------------------------------------------
// Tests — GET /api/ping
// ---------------------------------------------------------------------------

describe('GET /api/ping', () => {
  it('returns 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns ok:true with a timestamp', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.time).toBe('string');
    expect(() => new Date(body.time)).not.toThrow();
  });

  it('includes node version', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.node).toMatch(/^v\d+/);
  });

  it('includes env fields with masked values', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.env).toHaveProperty('NODE_ENV');
    expect(body.env).toHaveProperty('POSTGRES_URL');
    expect(body.env).toHaveProperty('REVEALUI_SECRET');
  });

  it('reports REVEALUI_SECRET as "set" when configured', async () => {
    process.env.REVEALUI_SECRET = SECRET;
    const res = await GET();
    const body = await res.json();
    expect(body.env.REVEALUI_SECRET).toBe('set');
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/capture-error
// ---------------------------------------------------------------------------

describe('POST /api/capture-error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_SECRET = SECRET;
  });

  it('returns 202 silently when REVEALUI_SECRET is not configured', async () => {
    delete process.env.REVEALUI_SECRET;
    const res = await POST(makeRequest('{"message":"oops"}'));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('proxies valid payload to upstream and returns its status', async () => {
    mockUpstream(202, { success: true });
    const res = await POST(makeRequest('{"message":"err","app":"admin","level":"error"}'));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('attaches X-Internal-Token header to upstream request', async () => {
    mockUpstream(202, { success: true });
    await POST(makeRequest('{}'));
    const [, init] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers['X-Internal-Token']).toBe(SECRET);
  });

  it('passes upstream error status through to client', async () => {
    mockUpstream(400, { error: 'bad request' }, false);
    const res = await POST(makeRequest('{"message":"err","app":"admin","level":"error"}'));
    expect(res.status).toBe(400);
  });

  it('returns 202 silently when upstream is unreachable (fetch throws)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await POST(makeRequest('{}'));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
