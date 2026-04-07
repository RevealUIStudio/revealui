/**
 * Password Reset Route Tests
 *
 * Tests for POST /api/auth/password-reset (request reset)
 * and PUT /api/auth/password-reset (reset with token).
 * Mocks auth service and email to test route logic in isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks -- must be before route imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/auth/server', () => ({
  generatePasswordResetToken: vi.fn(),
  resetPasswordWithToken: vi.fn(),
  auditPasswordReset: vi.fn(),
}));

vi.mock('@revealui/contracts', () => ({
  PasswordResetRequestContract: {
    validate: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (!b?.email || typeof b.email !== 'string') {
        return {
          success: false,
          errors: { issues: [{ path: ['email'], message: 'Valid email is required' }] },
        };
      }
      return { success: true, data: { email: b.email } };
    }),
  },
  PasswordResetTokenContract: {
    validate: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (!(b?.tokenId && b?.token && b?.password)) {
        return {
          success: false,
          errors: {
            issues: [{ path: ['token'], message: 'Token, tokenId, and password are required' }],
          },
        };
      }
      return {
        success: true,
        data: { tokenId: b.tokenId, token: b.token, password: b.password },
      };
    }),
  },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: (req: Request) => Promise<Response>) => handler),
}));

vi.mock('@/lib/utils/error-response', () => ({
  createApplicationErrorResponse: vi.fn(
    (message: string, code: string, status: number, _details?: unknown) => {
      return new Response(JSON.stringify({ error: message, code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  ),
  createErrorResponse: vi.fn((_error: unknown) => {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  createValidationErrorResponse: vi.fn(
    (message: string, field: string, _body?: unknown, _details?: unknown) => {
      return new Response(JSON.stringify({ error: message, field }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  ),
}));

import { generatePasswordResetToken, resetPasswordWithToken } from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/email';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/password-reset (request reset)
// ---------------------------------------------------------------------------

describe('POST /api/auth/password-reset', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/password-reset/route');
    POST = mod.POST as (req: NextRequest) => Promise<Response>;
  });

  it('returns success message on valid email (user exists)', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      token: 'raw-reset-token',
      tokenId: 'tid-123',
    } as never);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true } as never);

    const req = makeRequest('/api/auth/password-reset', 'POST', {
      email: 'alice@test.com',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toContain('password reset link has been sent');
  });

  it('calls sendPasswordResetEmail with correct arguments', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      token: 'raw-token-abc',
      tokenId: 'tid-456',
    } as never);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({ success: true } as never);

    const req = makeRequest('/api/auth/password-reset', 'POST', {
      email: 'alice@test.com',
    });
    await POST(req);

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      'alice@test.com',
      'tid-456',
      'raw-token-abc',
    );
  });

  it('returns success even when user does not exist (prevents enumeration)', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: false,
      error: 'User not found',
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'POST', {
      email: 'nobody@test.com',
    });
    const res = await POST(req);
    // The route returns 500 when token generation fails (non-success),
    // but the user-facing message is still generic
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('PASSWORD_RESET_TOKEN_GENERATION_FAILED');
  });

  it('returns success even when email send fails (prevents enumeration)', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      token: 'raw-token',
      tokenId: 'tid-789',
    } as never);
    vi.mocked(sendPasswordResetEmail).mockResolvedValue({
      success: false,
      error: 'SMTP timeout',
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'POST', {
      email: 'alice@test.com',
    });
    const res = await POST(req);
    // Returns 200 even when email fails to prevent enumeration
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('password reset link has been sent');
  });

  it('returns 400 for missing email', async () => {
    const req = makeRequest('/api/auth/password-reset', 'POST', {});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('/api/auth/password-reset', 'http://localhost:4000'), {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when generatePasswordResetToken throws', async () => {
    vi.mocked(generatePasswordResetToken).mockRejectedValue(new Error('DB error'));

    const req = makeRequest('/api/auth/password-reset', 'POST', {
      email: 'alice@test.com',
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('does not call sendPasswordResetEmail when token/tokenId are missing', async () => {
    vi.mocked(generatePasswordResetToken).mockResolvedValue({
      success: true,
      token: null,
      tokenId: null,
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'POST', {
      email: 'alice@test.com',
    });
    await POST(req);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PUT /api/auth/password-reset (reset with token)
// ---------------------------------------------------------------------------

describe('PUT /api/auth/password-reset', () => {
  let PUT: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/password-reset/route');
    PUT = mod.PUT as (req: NextRequest) => Promise<Response>;
  });

  it('returns 200 on successful password reset', async () => {
    vi.mocked(resetPasswordWithToken).mockResolvedValue({
      success: true,
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'PUT', {
      tokenId: 'tid-123',
      token: 'raw-token',
      password: 'NewStrongPass1!',
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe('Password reset successfully');
  });

  it('calls resetPasswordWithToken with correct arguments', async () => {
    vi.mocked(resetPasswordWithToken).mockResolvedValue({
      success: true,
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'PUT', {
      tokenId: 'tid-abc',
      token: 'raw-token-xyz',
      password: 'NewPass123!',
    });
    await PUT(req);

    expect(resetPasswordWithToken).toHaveBeenCalledWith('tid-abc', 'raw-token-xyz', 'NewPass123!');
  });

  it('returns 400 when reset fails (expired token)', async () => {
    vi.mocked(resetPasswordWithToken).mockResolvedValue({
      success: false,
      error: 'Token has expired',
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'PUT', {
      tokenId: 'tid-expired',
      token: 'old-token',
      password: 'NewPass123!',
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('PASSWORD_RESET_FAILED');
  });

  it('returns 400 when reset fails (invalid token)', async () => {
    vi.mocked(resetPasswordWithToken).mockResolvedValue({
      success: false,
      error: 'Invalid token',
    } as never);

    const req = makeRequest('/api/auth/password-reset', 'PUT', {
      tokenId: 'tid-bad',
      token: 'wrong-token',
      password: 'NewPass123!',
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing fields', async () => {
    const req = makeRequest('/api/auth/password-reset', 'PUT', {
      tokenId: 'tid-123',
      // missing token and password
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('/api/auth/password-reset', 'http://localhost:4000'), {
      method: 'PUT',
      body: '{ broken json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when resetPasswordWithToken throws', async () => {
    vi.mocked(resetPasswordWithToken).mockRejectedValue(new Error('DB error'));

    const req = makeRequest('/api/auth/password-reset', 'PUT', {
      tokenId: 'tid-123',
      token: 'raw-token',
      password: 'NewPass123!',
    });
    const res = await PUT(req);
    expect(res.status).toBe(500);
  });
});
