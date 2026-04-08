/**
 * Email Verification Route Tests
 *
 * Tests for GET /api/auth/verify-email?token=<token>.
 * Mocks database and rate limiter to test route logic in isolation.
 */

import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- must be before route imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetUserByVerificationToken = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({})),
}));

vi.mock('@revealui/db/queries/users', () => ({
  getUserByVerificationToken: (...args: unknown[]) => mockGetUserByVerificationToken(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
}));

import { checkRateLimit } from '@revealui/auth/server';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVerifyRequest(token?: string, ip?: string): NextRequest {
  const url = new URL('/api/auth/verify-email', 'http://localhost:4000');
  if (token) {
    url.searchParams.set('token', token);
  }

  const headers: Record<string, string> = {};
  if (ip) {
    headers['x-forwarded-for'] = ip;
  }

  return new NextRequest(url, {
    method: 'GET',
    headers,
  });
}

function setupTokenLookup(result: unknown): void {
  mockGetUserByVerificationToken.mockResolvedValue(result);
}

// ---------------------------------------------------------------------------
// GET /api/auth/verify-email
// ---------------------------------------------------------------------------

describe('GET /api/auth/verify-email', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 9 } as never);
    mockUpdateUser.mockResolvedValue(null);

    const mod = await import('../../app/api/auth/verify-email/route');
    GET = mod.GET as (req: NextRequest) => Promise<Response>;
  });

  it('redirects to login with missing_token error when no token provided', async () => {
    const req = makeVerifyRequest();
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?error=missing_token');
  });

  it('redirects to login with invalid_token when no user matches', async () => {
    setupTokenLookup(null); // no matching user

    const req = makeVerifyRequest('some-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?error=invalid_token');
  });

  it('redirects with already_verified when email is already verified', async () => {
    setupTokenLookup({ id: 'u1', emailVerified: true });

    const req = makeVerifyRequest('valid-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?message=already_verified');
  });

  it('verifies email and redirects with email_verified on success', async () => {
    setupTokenLookup({ id: 'u1', emailVerified: false });

    const req = makeVerifyRequest('valid-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?message=email_verified');

    // Verify updateUser was called to mark email as verified
    expect(mockUpdateUser).toHaveBeenCalledWith(
      expect.anything(), // db client
      'u1',
      expect.objectContaining({
        emailVerified: true,
        emailVerificationToken: null,
      }),
    );
  });

  it('hashes the token with SHA-256 before DB lookup', async () => {
    const rawToken = 'my-secret-token';
    const expectedHash = createHash('sha256').update(rawToken).digest('hex');

    setupTokenLookup({ id: 'u1', emailVerified: false });

    const req = makeVerifyRequest(rawToken);
    await GET(req);

    // Verify getUserByVerificationToken was called with the hashed token
    expect(mockGetUserByVerificationToken).toHaveBeenCalledWith(
      expect.anything(), // db client
      expectedHash,
    );
  });

  it('redirects with too_many_attempts when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0 } as never);

    const req = makeVerifyRequest('some-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?error=too_many_attempts');
  });

  it('redirects with verification_failed when rate limit check throws', async () => {
    vi.mocked(checkRateLimit).mockRejectedValue(new Error('Storage unavailable'));

    const req = makeVerifyRequest('some-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?error=verification_failed');
  });

  it('redirects with verification_failed when DB query throws', async () => {
    mockGetUserByVerificationToken.mockRejectedValue(new Error('DB connection failed'));

    const req = makeVerifyRequest('some-token');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toContain('/login?error=verification_failed');
  });

  it('extracts IP from x-forwarded-for for rate limiting', async () => {
    setupTokenLookup({ id: 'u1', emailVerified: false });

    const req = makeVerifyRequest('token', '1.2.3.4, 5.6.7.8');
    await GET(req);

    expect(checkRateLimit).toHaveBeenCalledWith(
      'verify_email:1.2.3.4',
      expect.objectContaining({
        maxAttempts: 10,
        windowMs: 15 * 60 * 1000,
      }),
    );
  });

  it('uses x-real-ip as fallback when x-forwarded-for is absent', async () => {
    setupTokenLookup({ id: 'u1', emailVerified: false });

    const url = new URL('/api/auth/verify-email', 'http://localhost:4000');
    url.searchParams.set('token', 'some-token');
    const req = new NextRequest(url, {
      method: 'GET',
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    await GET(req);

    expect(checkRateLimit).toHaveBeenCalledWith('verify_email:10.0.0.1', expect.any(Object));
  });

  it('uses "unknown" as IP fallback when no IP headers present', async () => {
    setupTokenLookup({ id: 'u1', emailVerified: false });

    const req = makeVerifyRequest('some-token');
    await GET(req);

    expect(checkRateLimit).toHaveBeenCalledWith('verify_email:unknown', expect.any(Object));
  });
});
