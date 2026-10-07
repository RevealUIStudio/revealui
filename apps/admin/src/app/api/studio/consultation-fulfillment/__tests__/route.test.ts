import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ session: vi.fn(), actor: vi.fn(), fetch: vi.fn() }));
function requestBody() {
  const body = mocks.fetch.mock.calls[0]?.[1]?.body;
  if (typeof body !== 'string') throw new Error('Expected a captured JSON request body');
  return JSON.parse(body);
}
vi.mock('@revealui/auth/server', async (original) => ({
  ...(await original<typeof import('@revealui/auth/server')>()),
  getSession: mocks.session,
}));
vi.mock('@revealui/db/client', () => ({ getRestClient: () => ({}) }));
vi.mock('@revealui/db/queries/sites', () => ({ getSiteContentActor: mocks.actor }));
vi.mock('@/lib/utils/request-context', () => ({ extractRequestContext: () => ({}) }));

import { POST } from '../route';

const secret = 'test-studio-owner-session-32-characters';
const prepare = {
  action: 'prepare',
  bookingId: 'paid-booking',
  buyerUserId: 'buyer',
  notes: 'Session notes',
  nextStep: 'Recommended next step',
};
const session = (changes = {}) => ({
  user: { id: 'operator', role: 'viewer', mfaEnabled: true, mustRotatePassword: false, ...changes },
  session: { metadata: { mfaVerified: true } },
});
const request = (body: unknown = prepare) =>
  new NextRequest('https://admin.example.test/api/studio/consultation-fulfillment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: 'revealui-session=browser-session' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.stubEnv('STUDIO_SITE_URL', 'https://studio.example.test');
  vi.stubEnv('STUDIO_OWNER_SESSION', secret);
  mocks.session.mockResolvedValue(session());
  mocks.actor.mockResolvedValue({
    id: 'operator',
    emailVerified: true,
    _json: { roles: ['super-admin'] },
  });
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'draft',
        siteId: 'delivery',
        sessionId: 'saved-session',
        delivered: false,
        ownerSession: secret,
      }),
      { status: 200 },
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe('canonical operator fulfillment bridge', () => {
  it('preserves truthful pending hostname verification and strips upstream secret fields', async () => {
    const dns = {
      configuredBy: 'CNAME',
      misconfigured: true,
      acceptedChallenges: ['http-01'],
      recommendedCNAME: [{ rank: 1, value: 'cname.vercel-dns.com' }],
      recommendedIPv4: [],
    };
    const pending = {
      status: 'domain-pending-verification',
      siteId: 'delivery',
      delivered: false,
      customDomainAttached: false,
      domain: null,
      hostname: 'client.customer.com',
      verification: [
        { type: 'TXT', domain: '_vercel.client.customer.com', value: 'control-proof' },
      ],
      dns,
    };
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...pending, token: secret }), { status: 202 }),
    );
    const result = await POST(
      request({
        action: 'attach-domain',
        bookingId: 'booking',
        buyerUserId: 'buyer',
        hostname: ' Client.Customer.COM ',
      }),
    );
    expect(result.status).toBe(202);
    expect(await result.json()).toEqual(pending);
    expect(requestBody()).toEqual({
      action: 'attach-domain',
      bookingId: 'booking',
      buyerUserId: 'buyer',
      hostname: 'client.customer.com',
    });
  });
  it('rejects reserved hostnames and contradictory attachment success', async () => {
    expect(
      (
        await POST(
          request({
            action: 'attach-domain',
            bookingId: 'booking',
            buyerUserId: 'buyer',
            hostname: 'admin.revealui.com',
          }),
        )
      ).status,
    ).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'domain-attached',
          siteId: 'delivery',
          delivered: false,
          customDomainAttached: false,
          domain: null,
        }),
      ),
    );
    expect(
      (await POST(request({ action: 'detach-domain', bookingId: 'booking', buyerUserId: 'buyer' })))
        .status,
    ).toBe(502);
  });
  it('rejects anonymous, forged shell authority and inactive canonical operators before calling Studio', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    mocks.session.mockResolvedValue(session({ role: 'admin' }));
    for (const actor of [
      null,
      { id: 'operator', emailVerified: false, _json: { roles: ['super-admin'] } },
      { id: 'operator', emailVerified: true, _json: '{"roles":["super-admin"]}' },
    ]) {
      mocks.actor.mockResolvedValue(actor);
      expect((await POST(request())).status).toBe(403);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('requires MFA for a canonical operator even with a viewer account role', async () => {
    mocks.session.mockResolvedValue(session({ mfaEnabled: false }));
    expect((await POST(request())).status).toBe(403);
    mocks.session.mockResolvedValue({ ...session(), session: { metadata: {} } });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('rejects recovery sessions and required password rotation', async () => {
    mocks.session.mockResolvedValue({
      ...session(),
      session: { metadata: { mfaVerified: true, recovery: true } },
    });
    expect((await POST(request())).status).toBe(403);
    mocks.session.mockResolvedValue(session({ mustRotatePassword: true }));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('uses exact configured origin and server credential without forwarding browser identity or exposing upstream fields', async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await result.json()).toEqual({
      status: 'draft',
      siteId: 'delivery',
      sessionId: 'saved-session',
      delivered: false,
    });
    expect(mocks.fetch).toHaveBeenCalledWith('https://studio.example.test/api/share', {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      signal: expect.any(AbortSignal),
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: expect.any(String),
    });
    expect(requestBody()).toEqual(prepare);
  });
  it.each([
    { ...prepare, origin: 'https://untrusted.example' },
    { action: 'publish', bookingId: 'paid-booking', buyerUserId: 'buyer' },
  ])('rejects invalid request fields', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('keeps absent or invalid optional configuration fail closed', async () => {
    vi.stubEnv('STUDIO_SITE_URL', '');
    vi.stubEnv('STUDIO_OWNER_SESSION', '');
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv('STUDIO_SITE_URL', 'https://studio.example.test/path');
    vi.stubEnv('STUDIO_OWNER_SESSION', secret);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('does not follow redirects and keeps upstream failure details private', async () => {
    mocks.fetch.mockRejectedValue(new Error('redirect'));
    expect((await POST(request())).status).toBe(502);
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: secret }), { status: 409 }));
    const result = await POST(request());
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({
      error: 'Studio could not complete this delivery',
      delivered: false,
    });
  });
  it('bounds an unresponsive Studio mutation and returns a private failure after abort', async () => {
    const controller = new AbortController();
    const deadline = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    mocks.fetch.mockImplementationOnce(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(options.signal?.reason));
          controller.abort(new DOMException('Timed out', 'TimeoutError'));
        }),
    );
    const result = await POST(request());
    expect(deadline).toHaveBeenCalledWith(90_000);
    expect(result.status).toBe(502);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await result.json()).toEqual({ error: 'Studio fulfillment is unavailable' });
  });
});

it('forwards an explicit domain-pack refund decision through the same authenticated owner', async () => {
  const body = {
    action: 'resolve-domain-pack',
    bookingId: 'paid-booking',
    buyerUserId: 'buyer',
    chargeId: 'ch_verified123',
    decision: 'retained',
  };
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'domain-pack-review-resolved',
        siteId: 'delivery',
        decision: 'retained',
        delivered: false,
      }),
    ),
  );
  const result = await POST(request(body));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    status: 'domain-pack-review-resolved',
    siteId: 'delivery',
    decision: 'retained',
    delivered: false,
  });
  expect(requestBody()).toEqual(body);
});
