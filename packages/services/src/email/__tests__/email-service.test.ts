/**
 * Tests for the email service providers + sendEmail retry logic
 * (src/email/index.ts). The pure header helpers (sanitizeEmailHeader,
 * encodeHeaderValue) are covered separately in headers.test.ts; this file
 * covers GmailProvider, MockEmailProvider, getEmailProvider selection, and
 * sendEmail's retry-with-backoff + prod-throw behavior.
 *
 * global fetch is mocked; env is stubbed per test. No real network or credentials.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearGmailAccessTokenCache,
  GmailProvider,
  getEmailProvider,
  MockEmailProvider,
  sendEmail,
} from '../index.js';

const realFetch = global.fetch;
const silentLogger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

interface MockRes {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}

function mockFetch(...responses: MockRes[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.json ?? {},
      text: async () => r.text ?? '',
    });
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

const opts = { to: 'user@example.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' };

function stubWif(): void {
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
  vi.stubEnv(
    'GOOGLE_WIF_PROVIDER',
    'projects/p/locations/global/workloadIdentityPools/pool/providers/vercel',
  );
  vi.stubEnv('VERCEL_OIDC_TOKEN', 'oidc');
}

function wifTokenHops(): MockRes[] {
  return [
    { ok: true, json: { access_token: 'fed' } },
    { ok: true, json: { signedJwt: 'jwt' } },
    { ok: true, json: { access_token: 'tok', expires_in: 3600 } },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  clearGmailAccessTokenCache();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
  vi.stubEnv('GOOGLE_WIF_PROVIDER', '');
  vi.stubEnv('VERCEL_OIDC_TOKEN', '');
  vi.stubEnv('EMAIL_FROM', 'noreply@revealui.com');
  vi.stubEnv('EMAIL_REPLY_TO', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = realFetch;
});

describe('GmailProvider', () => {
  it('returns not-configured when credentials are missing', async () => {
    const res = await new GmailProvider({ logger: silentLogger }).send(opts);
    expect(res).toEqual({
      success: false,
      error: 'Gmail WIF credentials not configured',
    });
  });

  it('sends successfully when token exchange + gmail send both succeed', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv(
      'GOOGLE_WIF_PROVIDER',
      'projects/p/locations/global/workloadIdentityPools/pool/providers/vercel',
    );
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'oidc');
    const fetchFn = mockFetch(
      { ok: true, json: { access_token: 'fed' } },
      { ok: true, json: { signedJwt: 'jwt' } },
      { ok: true, json: { access_token: 'tok' } },
      { ok: true },
    );

    const res = await new GmailProvider({ logger: silentLogger }).send({
      ...opts,
      replyTo: 'reply@example.com',
    });

    expect(res).toEqual({ success: true });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain('sts.googleapis.com');
    expect(String(fetchFn.mock.calls[1]?.[0])).toContain('iamcredentials.googleapis.com');
    expect(String(fetchFn.mock.calls[2]?.[0])).toContain('oauth2.googleapis.com');
    expect(String(fetchFn.mock.calls[3]?.[0])).toContain('gmail.googleapis.com');
  });

  it('reuses the Workspace access token on a second send (no second OAuth hop)', async () => {
    stubWif();
    const fetchFn = mockFetch(...wifTokenHops(), { ok: true }, { ok: true });
    const provider = new GmailProvider({ logger: silentLogger });
    await provider.send(opts);
    await provider.send(opts);
    expect(fetchFn).toHaveBeenCalledTimes(5);
    expect(String(fetchFn.mock.calls[3]?.[0])).toContain('gmail.googleapis.com');
    expect(String(fetchFn.mock.calls[4]?.[0])).toContain('gmail.googleapis.com');
  });

  it('builds a message without optional text/replyTo', async () => {
    stubWif();
    mockFetch(...wifTokenHops(), { ok: true });

    const res = await new GmailProvider({ logger: silentLogger }).send({
      to: 'a@b.com',
      subject: 'No-text subject',
      html: '<p>only html</p>',
    });

    expect(res).toEqual({ success: true });
  });

  it('returns an error (non-production) when the Gmail API responds non-ok', async () => {
    stubWif();
    mockFetch(...wifTokenHops(), { ok: false, status: 403, text: 'forbidden' });

    const res = await new GmailProvider({ logger: silentLogger }).send(opts);

    expect(res.success).toBe(false);
    expect(res.error).toContain('Gmail API error (403)');
  });

  it('throws in production when delivery fails', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    stubWif();
    mockFetch(...wifTokenHops(), { ok: false, status: 500, text: 'boom' });

    await expect(new GmailProvider({ logger: silentLogger }).send(opts)).rejects.toThrow(
      'Gmail email delivery failed',
    );
    expect(silentLogger.error).toHaveBeenCalled();
  });

  it('surfaces a token-exchange failure', async () => {
    stubWif();
    mockFetch({ ok: false, status: 401, text: 'bad jwt' });

    const res = await new GmailProvider({ logger: silentLogger }).send(opts);

    expect(res.success).toBe(false);
    expect(res.error).toContain('HTTP 401');
  });
});

describe('MockEmailProvider', () => {
  it('always succeeds and logs a debug line', async () => {
    const res = await new MockEmailProvider({ logger: silentLogger }).send(opts);
    expect(res).toEqual({ success: true });
    expect(silentLogger.debug).toHaveBeenCalled();
  });
});

describe('getEmailProvider', () => {
  it('returns a GmailProvider when credentials are present', () => {
    stubWif();
    expect(getEmailProvider({ logger: silentLogger })).toBeInstanceOf(GmailProvider);
  });

  it('returns a MockEmailProvider in development without credentials', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getEmailProvider({ logger: silentLogger })).toBeInstanceOf(MockEmailProvider);
    expect(silentLogger.warn).toHaveBeenCalled();
  });

  it('refuses Gmail when the HIPAA profile is on, even if credentials exist', async () => {
    vi.stubEnv('REVEALUI_COMPLIANCE_PROFILE', 'hipaa');
    stubWif();
    const provider = getEmailProvider({ logger: silentLogger });
    expect(provider).not.toBeInstanceOf(GmailProvider);
    await expect(provider.send(opts)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('HIPAA profile blocks Gmail API'),
    });
  });

  it('returns a no-op provider in non-dev without credentials', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const provider = getEmailProvider({ logger: silentLogger });
    expect(provider).not.toBeInstanceOf(GmailProvider);
    expect(provider).not.toBeInstanceOf(MockEmailProvider);
    await expect(provider.send(opts)).resolves.toEqual({
      success: false,
      error: 'No email provider configured',
    });
  });
});

describe('sendEmail', () => {
  it('returns success on the first successful attempt', async () => {
    vi.stubEnv('NODE_ENV', 'development'); // MockEmailProvider → success
    const res = await sendEmail(opts, { logger: silentLogger });
    expect(res).toEqual({ success: true });
  });

  it('retries a transient failure and then succeeds', async () => {
    stubWif();
    // attempt 1: token ok, gmail 500 → failure; attempt 2: cached token, gmail ok
    mockFetch(...wifTokenHops(), { ok: false, status: 500, text: 'temp' }, { ok: true });
    const res = await sendEmail(opts, { maxRetries: 2, logger: silentLogger });
    expect(res).toEqual({ success: true });
  });

  it('returns the failure (non-production) after exhausting retries', async () => {
    stubWif();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const res = await sendEmail(opts, { maxRetries: 1, logger: silentLogger });
    expect(res.success).toBe(false);
  });

  it('throws in production after exhausting retries', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    stubWif();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
      json: async () => ({}),
    }) as unknown as typeof fetch;
    await expect(sendEmail(opts, { maxRetries: 1, logger: silentLogger })).rejects.toThrow(
      'Email delivery failed',
    );
  });
});
