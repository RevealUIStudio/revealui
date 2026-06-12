/**
 * /api/media upload-forward route tests
 *
 * The route is a thin server-side forward to the api server's
 * POST /api/content/media (the single upload implementation: contracts
 * validation + object storage + media DB row). These tests pin the forward
 * contract: session gate, multipart content-type requirement, target URL,
 * header shape (Cookie/User-Agent passthrough, minted X-CSRF-Token bound to
 * the session cookie value, original Content-Type with its boundary), the
 * byte-identical streamed body with `duplex: 'half'`, success status/body
 * passthrough, preserved status with a generic body on upstream failure, and
 * 503 when the api server is unreachable.
 *
 * The multipart body is hand-encoded with a fixed boundary: this suite runs
 * under jsdom, whose FormData/File globals are not undici's, and undici's
 * multipart machinery rejects entries built from foreign classes. The route
 * never parses the body (it streams it through), so the tests assert the
 * forwarded bytes instead.
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCsrfToken } from '@/lib/utils/csrf-token';

const mockGetSession = vi.fn();
vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: undefined, ipAddress: undefined }),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const API_BASE = 'http://api-server.test';
const SESSION_COOKIE = 'session-cookie-value';
const BOUNDARY = 'vitest-boundary-2f1c55114';
const MULTIPART_CONTENT_TYPE = `multipart/form-data; boundary=${BOUNDARY}`;

function multipartUploadBody(): string {
  return [
    `--${BOUNDARY}`,
    'Content-Disposition: form-data; name="file"; filename="hero.png"',
    'Content-Type: image/png',
    '',
    'png-bytes',
    `--${BOUNDARY}`,
    'Content-Disposition: form-data; name="alt"',
    '',
    'Hero image',
    `--${BOUNDARY}--`,
    '',
  ].join('\r\n');
}

function makeUploadRequest(): NextRequest {
  return new NextRequest('http://admin.test/api/media', {
    method: 'POST',
    headers: {
      cookie: `revealui-session=${SESSION_COOKIE}`,
      'user-agent': 'vitest-agent',
      'content-type': MULTIPART_CONTENT_TYPE,
    },
    body: multipartUploadBody(),
  });
}

function uploadCreatedResponse(): Response {
  return Response.json(
    { success: true, data: { url: 'https://cdn.test/media/x.png' } },
    { status: 201 },
  );
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_API_URL', API_BASE);
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('POST /api/media', () => {
  it('returns 401 without a session and never contacts the api server', async () => {
    mockGetSession.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../route.js');
    const res = await POST(makeUploadRequest());

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 400 for a non-multipart body and never contacts the api server', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../route.js');
    const res = await POST(
      new NextRequest('http://admin.test/api/media', {
        method: 'POST',
        headers: {
          cookie: `revealui-session=${SESSION_COOKIE}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ nope: true }),
      }),
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards to the api server media route with the proxy header set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(uploadCreatedResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../route.js');
    await POST(makeUploadRequest());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { duplex?: string }];
    expect(url).toBe(`${API_BASE}/api/content/media`);
    expect(init.method).toBe('POST');
    expect(init.duplex).toBe('half');

    const headers = init.headers as Record<string, string>;
    // The original Content-Type is forwarded verbatim so the api server
    // parses against the client's multipart boundary.
    expect(Object.keys(headers).sort()).toEqual([
      'Content-Type',
      'Cookie',
      'User-Agent',
      'X-CSRF-Token',
    ]);
    expect(headers['Content-Type']).toBe(MULTIPART_CONTENT_TYPE);
    expect(headers.Cookie).toBe(`revealui-session=${SESSION_COOKIE}`);
    expect(headers['User-Agent']).toBe('vitest-agent');
    // The minted token must validate against the binding the api server's
    // csrfMiddleware checks: the session cookie value + REVEALUI_SECRET.
    const secret = process.env.REVEALUI_SECRET ?? '';
    expect(secret).not.toBe('');
    await expect(
      validateCsrfToken(headers['X-CSRF-Token'] ?? '', SESSION_COOKIE, secret),
    ).resolves.toBe(true);
  });

  it('streams the multipart body through byte-identical', async () => {
    const fetchMock = vi.fn().mockResolvedValue(uploadCreatedResponse());
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../route.js');
    await POST(makeUploadRequest());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const forwarded = await new Response(init.body as ReadableStream<Uint8Array>).text();
    expect(forwarded).toBe(multipartUploadBody());
  });

  it('passes the api server success status and body through to the editor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(uploadCreatedResponse()));

    const { POST } = await import('../route.js');
    const res = await POST(makeUploadRequest());

    expect(res.status).toBe(201);
    // The editor's getUploadUrl reads `data.url` from this body.
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { url: 'https://cdn.test/media/x.png' },
    });
  });

  it('preserves the upstream status with a generic body on api failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ success: false, error: { message: 'File too large' } }, { status: 413 }),
        ),
    );

    const { POST } = await import('../route.js');
    const res = await POST(makeUploadRequest());

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: 'API request failed' });
  });

  it('returns 503 when the api server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

    const { POST } = await import('../route.js');
    const res = await POST(makeUploadRequest());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'Content API unavailable' });
  });
});
