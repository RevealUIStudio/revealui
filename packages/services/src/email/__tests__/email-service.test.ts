/**
 * Tests for the email service providers + sendEmail retry logic
 * (src/email/index.ts). The pure header helpers (sanitizeEmailHeader,
 * encodeHeaderValue) are covered separately in headers.test.ts; this file
 * covers GmailProvider, MockEmailProvider, getEmailProvider selection, and
 * sendEmail's retry-with-backoff + prod-throw behavior.
 *
 * jose (importPKCS8 / SignJWT) and global fetch are mocked; env is stubbed
 * per test. No real network or credentials.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('jose', () => ({
  importPKCS8: vi.fn(async () => 'mock-key'),
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    sign() {
      return Promise.resolve('signed-jwt');
    }
  },
}));

import { GmailProvider, getEmailProvider, MockEmailProvider, sendEmail } from '../index.js';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '');
  vi.stubEnv('GOOGLE_PRIVATE_KEY', '');
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
      error: 'Gmail service account credentials not configured',
    });
  });

  it('sends successfully when token exchange + gmail send both succeed', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    const fetchFn = mockFetch({ ok: true, json: { access_token: 'tok' } }, { ok: true });

    const res = await new GmailProvider({ logger: silentLogger }).send({
      ...opts,
      replyTo: 'reply@example.com',
    });

    expect(res).toEqual({ success: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[0][0])).toContain('oauth2.googleapis.com');
    expect(String(fetchFn.mock.calls[1][0])).toContain('gmail.googleapis.com');
  });

  it('builds a message without optional text/replyTo', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    mockFetch({ ok: true, json: { access_token: 'tok' } }, { ok: true });

    const res = await new GmailProvider({ logger: silentLogger }).send({
      to: 'a@b.com',
      subject: 'No-text subject',
      html: '<p>only html</p>',
    });

    expect(res).toEqual({ success: true });
  });

  it('returns an error (non-production) when the Gmail API responds non-ok', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    mockFetch(
      { ok: true, json: { access_token: 'tok' } },
      { ok: false, status: 403, text: 'forbidden' },
    );

    const res = await new GmailProvider({ logger: silentLogger }).send(opts);

    expect(res.success).toBe(false);
    expect(res.error).toContain('Gmail API error (403)');
  });

  it('throws in production when delivery fails', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    mockFetch(
      { ok: true, json: { access_token: 'tok' } },
      { ok: false, status: 500, text: 'boom' },
    );

    await expect(new GmailProvider({ logger: silentLogger }).send(opts)).rejects.toThrow(
      'Gmail email delivery failed',
    );
    expect(silentLogger.error).toHaveBeenCalled();
  });

  it('surfaces a token-exchange failure', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    mockFetch({ ok: false, status: 401, text: 'bad jwt' });

    const res = await new GmailProvider({ logger: silentLogger }).send(opts);

    expect(res.success).toBe(false);
    expect(res.error).toContain('token exchange failed');
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
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    expect(getEmailProvider({ logger: silentLogger })).toBeInstanceOf(GmailProvider);
  });

  it('returns a MockEmailProvider in development without credentials', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getEmailProvider({ logger: silentLogger })).toBeInstanceOf(MockEmailProvider);
    expect(silentLogger.warn).toHaveBeenCalled();
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
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
    // attempt 1: token ok, gmail 500 → failure; attempt 2: token ok, gmail ok → success
    mockFetch(
      { ok: true, json: { access_token: 't' } },
      { ok: false, status: 500, text: 'temp' },
      { ok: true, json: { access_token: 't' } },
      { ok: true },
    );
    const res = await sendEmail(opts, { maxRetries: 2, logger: silentLogger });
    expect(res).toEqual({ success: true });
  });

  it('returns the failure (non-production) after exhausting retries', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
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
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'sa@p.iam.gserviceaccount.com');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'pk');
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
