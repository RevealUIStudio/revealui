/**
 * Resend Verification Route Tests
 *
 * POST /api/auth/resend-verification — covers the authenticated mode
 * (token rotation + send for the session user) and the no-session mode
 * (constant generic 200, per-email rate limit, deferred send only for
 * existing unverified accounts — the anti-enumeration contract).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSession = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

const mockGetUserByEmail = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: () => ({}),
}));

vi.mock('@revealui/db/queries/users', () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
}));

const mockSendVerificationEmail = vi.fn();

vi.mock('@/lib/email/verification', () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
}));

// Import NextRequest + the route after mocks.
import { NextRequest } from 'next/server';
import { POST } from '../../app/api/auth/resend-verification/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body?: unknown): NextRequest {
  return new NextRequest('http://localhost:4000/api/auth/resend-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** First recorded call of a mock, typed — throws instead of returning undefined. */
function firstCall<T extends unknown[]>(mock: { mock: { calls: unknown[][] } }): T {
  const call = mock.mock.calls[0];
  if (!call) {
    throw new Error('expected mock to have been called');
  }
  return call as T;
}

interface TokenRotationFields {
  emailVerificationToken: string;
  emailVerificationTokenExpiresAt: Date;
}

const ALLOWED = { allowed: true, remaining: 2, resetAt: 0 };
const BLOCKED = { allowed: false, remaining: 0, resetAt: 0 };

const UNVERIFIED_USER = {
  id: 'user-1',
  email: 'pending@example.com',
  emailVerified: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue(ALLOWED);
  mockSendVerificationEmail.mockResolvedValue({ success: true });
  mockUpdateUser.mockResolvedValue(undefined);
  mockGetUserByEmail.mockResolvedValue(null);
  mockGetSession.mockResolvedValue(null);
});

describe('POST /api/auth/resend-verification — authenticated mode', () => {
  it('rotates the token (with a fresh expiry) and sends to the session user', async () => {
    mockGetSession.mockResolvedValue({ user: UNVERIFIED_USER });

    const response = await POST(createRequest({}));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    const [, userId, fields] = firstCall<[unknown, string, TokenRotationFields]>(mockUpdateUser);
    expect(userId).toBe('user-1');
    expect(typeof fields.emailVerificationToken).toBe('string');
    expect(fields.emailVerificationToken).toHaveLength(64); // sha256 hex
    expect(fields.emailVerificationTokenExpiresAt).toBeInstanceOf(Date);

    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
    const [sentTo, rawToken] = firstCall<[string, string]>(mockSendVerificationEmail);
    expect(sentTo).toBe('pending@example.com');
    // The raw token goes to email; only its hash is stored.
    expect(rawToken).toHaveLength(64);
    expect(rawToken).not.toBe(fields.emailVerificationToken);
  });

  it('returns ALREADY_VERIFIED for a verified session user', async () => {
    mockGetSession.mockResolvedValue({
      user: { ...UNVERIFIED_USER, emailVerified: true },
    });

    const response = await POST(createRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('ALREADY_VERIFIED');
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('returns EMAIL_SEND_FAILED when the provider send fails', async () => {
    mockGetSession.mockResolvedValue({ user: UNVERIFIED_USER });
    mockSendVerificationEmail.mockResolvedValue({ success: false, error: 'smtp down' });

    const response = await POST(createRequest({}));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.code).toBe('EMAIL_SEND_FAILED');
  });
});

describe('POST /api/auth/resend-verification — no-session mode', () => {
  it('sends to an existing unverified account and returns the generic 200', async () => {
    mockGetUserByEmail.mockResolvedValue(UNVERIFIED_USER);

    const response = await POST(createRequest({ email: 'pending@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    expect(mockGetUserByEmail).toHaveBeenCalledWith({}, 'pending@example.com');
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    const [, , rotatedFields] = firstCall<[unknown, string, TokenRotationFields]>(mockUpdateUser);
    expect(rotatedFields.emailVerificationTokenExpiresAt).toBeInstanceOf(Date);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      'pending@example.com',
      expect.any(String),
    );
  });

  it('returns the identical body for a nonexistent account and sends nothing', async () => {
    mockGetUserByEmail.mockResolvedValue(UNVERIFIED_USER);
    const existing = await (await POST(createRequest({ email: 'pending@example.com' }))).json();

    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(ALLOWED);
    mockGetSession.mockResolvedValue(null);
    mockGetUserByEmail.mockResolvedValue(null);

    const response = await POST(createRequest({ email: 'nobody@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(existing); // anti-enumeration: byte-identical body
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not send for an already-verified account (same generic 200)', async () => {
    mockGetUserByEmail.mockResolvedValue({ ...UNVERIFIED_USER, emailVerified: true });

    const response = await POST(createRequest({ email: 'pending@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('enforces the per-email rate limit without changing the response', async () => {
    mockGetUserByEmail.mockResolvedValue(UNVERIFIED_USER);
    mockCheckRateLimit.mockImplementation((key: string) =>
      Promise.resolve(key.startsWith('resend-verification:email:') ? BLOCKED : ALLOWED),
    );

    const response = await POST(createRequest({ email: 'pending@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();

    // The per-email key is a hash, never the raw address.
    const emailKeyCall = mockCheckRateLimit.mock.calls.find(([key]) =>
      String(key).startsWith('resend-verification:email:'),
    );
    expect(emailKeyCall).toBeDefined();
    expect(String(emailKeyCall?.[0])).not.toContain('pending@example.com');
  });

  it('rejects a missing or invalid email with 400 INVALID_EMAIL', async () => {
    const missing = await POST(createRequest({}));
    expect(missing.status).toBe(400);
    expect((await missing.json()).code).toBe('INVALID_EMAIL');

    const invalid = await POST(createRequest({ email: 'not-an-email' }));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).code).toBe('INVALID_EMAIL');

    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it('still returns the generic 200 when the deferred send fails (logged only)', async () => {
    mockGetUserByEmail.mockResolvedValue(UNVERIFIED_USER);
    mockSendVerificationEmail.mockResolvedValue({ success: false, error: 'smtp down' });

    const response = await POST(createRequest({ email: 'pending@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
