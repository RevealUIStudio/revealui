/**
 * Billing same-origin proxy: App Router routes must beat (backend)/api/[...slug].
 * next.config rewrites never run for /api/* because the CMS catch-all wins.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCsrfToken } from '../../lib/utils/csrf-token';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getSession } from '@revealui/auth/server';

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'test-user', token: 'tok' }),
}));

const mockGetSession = vi.mocked(getSession);

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: vi.fn().mockReturnValue({}),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST as checkoutPerpetualPost } from '../../app/api/billing/checkout-perpetual/route';
import { POST as checkoutSupportRenewalPost } from '../../app/api/billing/checkout-support-renewal/route';
import { GET as subscriptionGet } from '../../app/api/billing/subscription/route';

const adminSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function readAdminSrc(relPath: string): string {
  return readFileSync(path.join(adminSrc, relPath), 'utf8');
}

function makeUpstreamOk(data: unknown, status = 200) {
  return {
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function makeUpstreamError(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function forwardedHeaders(): Record<string, string> {
  const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

describe('billing App Router routes beat the CMS catch-all', () => {
  it('ships a specific subscription route that forwards Cookie via apiForwardHeaders', () => {
    const specific = readAdminSrc('app/api/billing/subscription/route.ts');
    const helper = readAdminSrc('lib/utils/billing-api-proxy.ts');
    expect(specific.includes('/api/billing/subscription')).toBe(true);
    expect(helper.includes("from '@/lib/utils/api-proxy-headers'")).toBe(true);
    expect(helper.includes('apiForwardHeaders')).toBe(true);
  });

  it('does not handle /api/billing/subscription in the CMS catch-all', () => {
    const catchAll = readAdminSrc('app/(backend)/api/[...slug]/route.ts');
    expect(catchAll.includes('createRESTHandlers')).toBe(true);
    expect(catchAll.includes('billing')).toBe(false);
    expect(catchAll.includes('subscription')).toBe(false);
  });

  it('ships specific checkout POST routes for the license page', () => {
    const perpetual = readAdminSrc('app/api/billing/checkout-perpetual/route.ts');
    const renewal = readAdminSrc('app/api/billing/checkout-support-renewal/route.ts');
    const helper = readAdminSrc('lib/utils/billing-api-proxy.ts');
    expect(perpetual.includes('/api/billing/checkout-perpetual')).toBe(true);
    expect(renewal.includes('/api/billing/checkout-support-renewal')).toBe(true);
    expect(helper.includes('apiForwardHeaders')).toBe(true);
  });
});

describe('GET /api/billing/subscription', () => {
  const SECRET = 'proxy-test-secret-32-chars-long!!';
  const SESSION_COOKIE_VALUE = 'sess-billing-1';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: 'test-user', token: 'tok' });
    vi.stubEnv('REVEALUI_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards Cookie + User-Agent to the API host and passes through the body', async () => {
    mockFetch.mockResolvedValueOnce(
      makeUpstreamOk({
        tier: 'pro',
        status: 'active',
        licenseKey: null,
        perpetual: false,
      }),
    );

    const req = new NextRequest('http://localhost/api/billing/subscription', {
      headers: {
        Cookie: `revealui-session=${SESSION_COOKIE_VALUE}`,
        'User-Agent': 'TestBrowser/1.0',
      },
    });
    const res = await subscriptionGet(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      tier: 'pro',
      status: 'active',
      licenseKey: null,
      perpetual: false,
    });
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/api/billing/subscription');
    expect(String(mockFetch.mock.calls[0]?.[0])).not.toContain('localhost/api/billing');

    const headers = forwardedHeaders();
    expect(headers.Cookie).toBe(`revealui-session=${SESSION_COOKIE_VALUE}`);
    expect(headers['User-Agent']).toBe('TestBrowser/1.0');
  });

  it('returns 401 and does not fetch upstream when there is no session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/billing/subscription');
    const res = await subscriptionGet(req);
    expect(res.status).toBe(401);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('passes through an upstream 401 without inventing a license', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamError(401, { error: 'Unauthorized' }));
    const req = new NextRequest('http://localhost/api/billing/subscription');
    const res = await subscriptionGet(req);
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});

describe('POST /api/billing/checkout-perpetual', () => {
  const SECRET = 'proxy-test-secret-32-chars-long!!';
  const SESSION_COOKIE_VALUE = 'sess-billing-2';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: 'test-user', token: 'tok' });
    vi.stubEnv('REVEALUI_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards Cookie, body, and a minted CSRF token to the API host', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ url: 'https://checkout.stripe.com/c/test' }));

    const req = new NextRequest('http://localhost/api/billing/checkout-perpetual', {
      method: 'POST',
      body: JSON.stringify({ tier: 'pro' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `revealui-session=${SESSION_COOKIE_VALUE}`,
        'User-Agent': 'TestBrowser/1.0',
      },
    });
    const res = await checkoutPerpetualPost(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ url: 'https://checkout.stripe.com/c/test' });
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/api/billing/checkout-perpetual');

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ tier: 'pro' }));

    const headers = forwardedHeaders();
    expect(headers.Cookie).toBe(`revealui-session=${SESSION_COOKIE_VALUE}`);
    expect(headers['Content-Type']).toBe('application/json');
    const token = headers['X-CSRF-Token'] ?? '';
    expect(token).toBeTruthy();
    await expect(validateCsrfToken(token, SESSION_COOKIE_VALUE, SECRET)).resolves.toBe(true);
  });
});

describe('POST /api/billing/checkout-support-renewal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: 'test-user', token: 'tok' });
  });

  it('forwards an empty-body POST and Cookie to the API host', async () => {
    mockFetch.mockResolvedValueOnce(makeUpstreamOk({ url: 'https://checkout.stripe.com/c/renew' }));

    const req = new NextRequest('http://localhost/api/billing/checkout-support-renewal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'revealui-session=sess-renew-1',
      },
    });
    const res = await checkoutSupportRenewalPost(req);

    expect(res.status).toBe(200);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain('/api/billing/checkout-support-renewal');
    const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(forwardedHeaders().Cookie).toBe('revealui-session=sess-renew-1');
  });
});
