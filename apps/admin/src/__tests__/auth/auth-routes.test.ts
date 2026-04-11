/**
 * admin Auth Route Tests
 *
 * Tests for sign-in, sign-up, and resend-verification route handlers.
 * Focuses on validation, error handling, rate limiting config,
 * and response structure  -  not the auth engine itself (tested in auth package).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must be before route imports
// ---------------------------------------------------------------------------

vi.mock('@revealui/contracts', () => ({
  SignInRequestContract: {
    validate: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (!(b?.email && b?.password)) {
        return {
          success: false,
          errors: { issues: [{ path: ['email'], message: 'Required' }] },
        };
      }
      return { success: true, data: { email: b.email, password: b.password } };
    }),
  },
  SignUpRequestContract: {
    validate: vi.fn((body: unknown) => {
      const b = body as Record<string, unknown>;
      if (!(b?.email && b?.password && b?.name)) {
        return {
          success: false,
          errors: { issues: [{ path: ['name'], message: 'Required' }] },
        };
      }
      return { success: true, data: { email: b.email, password: b.password, name: b.name } };
    }),
  },
}));

vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  isSignupAllowed: vi.fn().mockReturnValue(true),
}));

vi.mock('@revealui/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@revealui/core/license', () => ({
  initializeLicense: vi.fn().mockResolvedValue('free'),
  getMaxUsers: vi.fn().mockReturnValue(3),
}));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ total: 0 }]),
        })),
      })),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          execute: vi.fn().mockResolvedValue(undefined),
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ total: 0 }]),
            })),
          })),
        };
        return cb(tx);
      }),
      update: vi.fn(() => ({ set: mockSet })),
    };
  }),
}));

vi.mock('@revealui/db/schema', () => ({
  users: { id: 'id', email: 'email', status: 'status' },
}));

vi.mock('drizzle-orm', () => {
  // sql is a tagged template function in drizzle-orm
  const sqlFn = () => ({ sql: 'mock' });
  sqlFn.raw = vi.fn();
  return { eq: vi.fn(), count: vi.fn(), sql: sqlFn };
});

vi.mock('@revealui/db/queries/users', () => ({
  updateUser: vi.fn().mockResolvedValue(null),
  countActiveUsers: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/email/verification', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: (req: Request) => Promise<Response>) => handler),
}));

vi.mock('@/lib/utils/error-response', () => ({
  createApplicationErrorResponse: vi.fn((message: string, code: string, status: number) => {
    return new Response(JSON.stringify({ error: message, code }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  createErrorResponse: vi.fn((_error: unknown) => {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
  createValidationErrorResponse: vi.fn((message: string, field: string) => {
    return new Response(JSON.stringify({ error: message, field }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
}));

import { getSession, isSignupAllowed, signIn, signUp } from '@revealui/auth/server';
import { getMaxUsers } from '@revealui/core/license';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

// ---------------------------------------------------------------------------
// Sign In
// ---------------------------------------------------------------------------

describe('POST /api/auth/sign-in', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/sign-in/route');
    POST = mod.POST as (req: NextRequest) => Promise<Response>;
  });

  it('returns 200 with user data on successful login', async () => {
    vi.mocked(signIn).mockResolvedValue({
      success: true,
      sessionToken: 'tok-abc',
      user: {
        id: 'u1',
        email: 'alice@test.com',
        name: 'Alice',
        avatarUrl: null,
        role: 'admin',
      },
    } as never);

    const req = makeRequest('/api/auth/sign-in', {
      email: 'alice@test.com',
      password: 'Password123!',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe('alice@test.com');
  });

  it('returns 401 for invalid credentials', async () => {
    vi.mocked(signIn).mockResolvedValue({
      success: false,
      error: 'Invalid email or password',
      reason: 'invalid_credentials',
    } as never);

    const req = makeRequest('/api/auth/sign-in', {
      email: 'alice@test.com',
      password: 'wrong',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('/api/auth/sign-in', 'http://localhost:4000'), {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing email field', async () => {
    const req = makeRequest('/api/auth/sign-in', { password: 'Password123!' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing password field', async () => {
    const req = makeRequest('/api/auth/sign-in', { email: 'alice@test.com' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('sets session cookie on successful login', async () => {
    vi.mocked(signIn).mockResolvedValue({
      success: true,
      sessionToken: 'tok-abc',
      user: {
        id: 'u1',
        email: 'alice@test.com',
        name: 'Alice',
        avatarUrl: null,
        role: 'admin',
      },
    } as never);

    const req = makeRequest('/api/auth/sign-in', {
      email: 'alice@test.com',
      password: 'Password123!',
    });
    const res = await POST(req);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('revealui-session');
  });
});

// ---------------------------------------------------------------------------
// Sign Up
// ---------------------------------------------------------------------------

describe('POST /api/auth/sign-up', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(isSignupAllowed).mockReturnValue(true);
    vi.mocked(getMaxUsers).mockReturnValue(Infinity);
    const mod = await import('../../app/api/auth/sign-up/route');
    POST = mod.POST as (req: NextRequest) => Promise<Response>;
  });

  it('returns 200 with user data on successful signup', async () => {
    vi.mocked(signUp).mockResolvedValue({
      success: true,
      sessionToken: 'tok-new',
      user: {
        id: 'u2',
        email: 'bob@test.com',
        name: 'Bob',
        avatarUrl: null,
        role: 'viewer',
        emailVerified: false,
      },
    } as never);

    const req = makeRequest('/api/auth/sign-up', {
      email: 'bob@test.com',
      password: 'StrongPass1!',
      name: 'Bob',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe('bob@test.com');
  });

  it('returns 400 for duplicate email (signUp failure)', async () => {
    vi.mocked(signUp).mockResolvedValue({
      success: false,
      error: 'Email already exists',
    } as never);

    const req = makeRequest('/api/auth/sign-up', {
      email: 'existing@test.com',
      password: 'StrongPass1!',
      name: 'Dupe',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when signup is restricted', async () => {
    vi.mocked(isSignupAllowed).mockReturnValue(false);

    const req = makeRequest('/api/auth/sign-up', {
      email: 'new@test.com',
      password: 'StrongPass1!',
      name: 'New User',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user limit is reached', async () => {
    vi.mocked(getMaxUsers).mockReturnValue(3);
    const { getClient } = await import('@revealui/db');
    vi.mocked(getClient).mockReturnValue({
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
        const tx = {
          execute: vi.fn(),
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ total: 3 }]),
            })),
          })),
        };
        return cb(tx);
      }),
    } as never);

    const req = makeRequest('/api/auth/sign-up', {
      email: 'new@test.com',
      password: 'StrongPass1!',
      name: 'New User',
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing name field', async () => {
    const req = makeRequest('/api/auth/sign-up', {
      email: 'new@test.com',
      password: 'StrongPass1!',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('does not set session cookie for unverified email', async () => {
    vi.mocked(signUp).mockResolvedValue({
      success: true,
      sessionToken: 'tok-new',
      user: {
        id: 'u2',
        email: 'bob@test.com',
        name: 'Bob',
        emailVerified: false,
      },
    } as never);

    const req = makeRequest('/api/auth/sign-up', {
      email: 'bob@test.com',
      password: 'StrongPass1!',
      name: 'Bob',
    });
    const res = await POST(req);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resend Verification
// ---------------------------------------------------------------------------

describe('POST /api/auth/resend-verification', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../../app/api/auth/resend-verification/route');
    POST = mod.POST as (req: NextRequest) => Promise<Response>;
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const req = makeRequest('/api/auth/resend-verification', {});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when email is already verified', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com', emailVerified: true },
    } as never);

    const req = makeRequest('/api/auth/resend-verification', {});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when user has no email', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'u1', email: null, emailVerified: false },
    } as never);

    const req = makeRequest('/api/auth/resend-verification', {});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful resend', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'u1', email: 'unverified@test.com', emailVerified: false },
    } as never);

    // Re-mock getClient for this test to ensure update chain works
    const { getClient } = await import('@revealui/db');
    vi.mocked(getClient).mockReturnValue({
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    } as never);

    const { sendVerificationEmail } = await import('@/lib/email/verification');
    vi.mocked(sendVerificationEmail).mockResolvedValue({ success: true } as never);

    const req = makeRequest('/api/auth/resend-verification', {});
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 500 when email send fails', async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: 'u1', email: 'fail@test.com', emailVerified: false },
    } as never);

    const { sendVerificationEmail } = await import('@/lib/email/verification');
    vi.mocked(sendVerificationEmail).mockResolvedValue({
      success: false,
      error: 'SMTP timeout',
    } as never);

    const req = makeRequest('/api/auth/resend-verification', {});
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
