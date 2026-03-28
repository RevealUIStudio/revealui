/**
 * Tests for password management routes:
 * - POST /api/auth/change-password (authenticated password change)
 * - POST /api/auth/password-reset (request reset token)
 * - PUT  /api/auth/password-reset (reset with token)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockChangePassword = vi.fn();
const mockDeleteOtherUserSessions = vi.fn();
const mockMeetsMinimumPasswordRequirements = vi.fn();
const mockGeneratePasswordResetToken = vi.fn();
const mockResetPasswordWithToken = vi.fn();
const mockPasswordResetRequestValidate = vi.fn();
const mockPasswordResetTokenValidate = vi.fn();
const mockSendPasswordResetEmail = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
  deleteOtherUserSessions: (...args: unknown[]) => mockDeleteOtherUserSessions(...args),
  meetsMinimumPasswordRequirements: (...args: unknown[]) =>
    mockMeetsMinimumPasswordRequirements(...args),
  generatePasswordResetToken: (...args: unknown[]) => mockGeneratePasswordResetToken(...args),
  resetPasswordWithToken: (...args: unknown[]) => mockResetPasswordWithToken(...args),
}));

vi.mock('@revealui/contracts', () => ({
  PasswordResetRequestContract: {
    validate: (...args: unknown[]) => mockPasswordResetRequestValidate(...args),
  },
  PasswordResetTokenContract: {
    validate: (...args: unknown[]) => mockPasswordResetTokenValidate(...args),
  },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: (handler: (...args: unknown[]) => unknown, _opts?: unknown) => handler,
}));

vi.mock('@/lib/utils/error-response', () => {
  const { NextResponse } = require('next/server');
  return {
    createApplicationErrorResponse: (msg: string, code: string, status = 500) =>
      NextResponse.json({ error: msg, code }, { status }),
    createErrorResponse: (err: unknown) =>
      NextResponse.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 },
      ),
    createValidationErrorResponse: (
      msg: string,
      field: string,
      _value: unknown,
      details?: unknown,
    ) => NextResponse.json({ error: msg, field, details }, { status: 400 }),
  };
});

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

function makeRequest(body?: unknown) {
  return {
    headers: { get: () => null },
    json:
      body !== undefined ? () => Promise.resolve(body) : () => Promise.reject(new Error('no body')),
  } as never;
}

// ─── POST /api/auth/change-password ──────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../change-password/route.js');
    return mod.POST;
  }

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const POST = await loadRoute();
    const res = await POST(makeRequest({ currentPassword: 'old', newPassword: 'NewPass1!' }));
    expect((res as { status: number }).status).toBe(401);
  });

  it('returns 400 when request body is invalid JSON', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    const req = {
      headers: { get: () => null },
      json: () => Promise.reject(new Error('bad json')),
    } as never;
    const res = await POST(req);
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when Zod validation fails', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    const POST = await loadRoute();
    // Missing required fields
    const res = await POST(makeRequest({}));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 400 when new password does not meet requirements', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockMeetsMinimumPasswordRequirements.mockReturnValue(false);

    const POST = await loadRoute();
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'WeakPass1' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('changes password and returns success', async () => {
    mockGetSession.mockResolvedValue({ session: { id: 'sess-1' }, user: { id: 'u1' } });
    mockMeetsMinimumPasswordRequirements.mockReturnValue(true);
    mockChangePassword.mockResolvedValue({ success: true });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }));

    expect((res as { status: number }).status).toBe(200);
    expect(mockChangePassword).toHaveBeenCalledWith('u1', 'OldPass1!', 'NewPass1!');
  });

  it('revokes other sessions when requested', async () => {
    mockGetSession.mockResolvedValue({ session: { id: 'sess-1' }, user: { id: 'u1' } });
    mockMeetsMinimumPasswordRequirements.mockReturnValue(true);
    mockChangePassword.mockResolvedValue({ success: true });

    const POST = await loadRoute();
    await POST(
      makeRequest({
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
        revokeOtherSessions: true,
      }),
    );

    expect(mockDeleteOtherUserSessions).toHaveBeenCalledWith('u1', 'sess-1');
  });

  it('returns 400 when current password is incorrect', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockMeetsMinimumPasswordRequirements.mockReturnValue(true);
    mockChangePassword.mockResolvedValue({
      success: false,
      error: 'Current password is incorrect.',
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ currentPassword: 'Wrong!', newPassword: 'NewPass1!' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockMeetsMinimumPasswordRequirements.mockReturnValue(true);
    mockChangePassword.mockResolvedValue({
      success: false,
      error: 'User not found.',
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ currentPassword: 'OldPass1!', newPassword: 'NewPass1!' }));
    expect((res as { status: number }).status).toBe(404);
  });
});

// ─── POST /api/auth/password-reset (request token) ──────────────────────────

describe('POST /api/auth/password-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../password-reset/route.js');
    return mod.POST;
  }

  it('returns 400 when validation fails', async () => {
    mockPasswordResetRequestValidate.mockReturnValue({
      success: false,
      errors: { issues: [{ message: 'Invalid email', path: ['email'] }] },
    });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'bad' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('always returns success to prevent user enumeration', async () => {
    mockPasswordResetRequestValidate.mockReturnValue({
      success: true,
      data: { email: 'test@example.com' },
    });
    mockGeneratePasswordResetToken.mockResolvedValue({
      success: true,
      token: 'raw-token',
      tokenId: 'token-id',
    });
    mockSendPasswordResetEmail.mockResolvedValue({ success: true });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'test@example.com' }));

    expect((res as { status: number }).status).toBe(200);
    expect((res as unknown as { body: { message: string } }).body.message).toContain(
      'If an account exists',
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      'test@example.com',
      'token-id',
      'raw-token',
    );
  });

  it('returns success even when email send fails (no user enumeration)', async () => {
    mockPasswordResetRequestValidate.mockReturnValue({
      success: true,
      data: { email: 'ghost@example.com' },
    });
    mockGeneratePasswordResetToken.mockResolvedValue({
      success: true,
      token: 'tok',
      tokenId: 'tid',
    });
    mockSendPasswordResetEmail.mockResolvedValue({ success: false, error: 'SMTP down' });

    const POST = await loadRoute();
    const res = await POST(makeRequest({ email: 'ghost@example.com' }));

    // Should still return 200 — never reveal whether email exists
    expect((res as { status: number }).status).toBe(200);
  });
});

// ─── PUT /api/auth/password-reset (use token) ───────────────────────────────

describe('PUT /api/auth/password-reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadRoute() {
    const mod = await import('../password-reset/route.js');
    return mod.PUT;
  }

  it('returns 400 when validation fails', async () => {
    mockPasswordResetTokenValidate.mockReturnValue({
      success: false,
      errors: { issues: [{ message: 'Token required', path: ['token'] }] },
    });

    const PUT = await loadRoute();
    const res = await PUT(makeRequest({ tokenId: '', token: '', password: '' }));
    expect((res as { status: number }).status).toBe(400);
  });

  it('resets password successfully', async () => {
    mockPasswordResetTokenValidate.mockReturnValue({
      success: true,
      data: { tokenId: 'tid', token: 'tok', password: 'NewPass1!' },
    });
    mockResetPasswordWithToken.mockResolvedValue({ success: true });

    const PUT = await loadRoute();
    const res = await PUT(makeRequest({ tokenId: 'tid', token: 'tok', password: 'NewPass1!' }));

    expect((res as { status: number }).status).toBe(200);
    expect(mockResetPasswordWithToken).toHaveBeenCalledWith('tid', 'tok', 'NewPass1!');
  });

  it('returns 400 when token is invalid or expired', async () => {
    mockPasswordResetTokenValidate.mockReturnValue({
      success: true,
      data: { tokenId: 'tid', token: 'bad-tok', password: 'NewPass1!' },
    });
    mockResetPasswordWithToken.mockResolvedValue({
      success: false,
      error: 'Token expired',
    });

    const PUT = await loadRoute();
    const res = await PUT(makeRequest({ tokenId: 'tid', token: 'bad-tok', password: 'NewPass1!' }));

    expect((res as { status: number }).status).toBe(400);
  });
});
