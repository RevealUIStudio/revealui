/**
 * Recovery API Route Tests
 *
 * Tests both recovery routes:
 * - POST /api/auth/recovery/request — magic link generation
 * - POST /api/auth/recovery/verify  — token verification + session creation
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the auth server
vi.mock('@revealui/auth/server', () => ({
  createMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
  createSession: vi.fn(),
  deleteAllUserSessions: vi.fn(),
  checkRateLimit: vi.fn(),
}));

// Mock the logger
vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the rate limit module to pass through
vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: (request: NextRequest) => Promise<Response>) => handler),
}));

// Mock the email module
vi.mock('@/lib/email', () => ({
  sendRecoveryEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock the database
const mockGetUserByEmail = vi.fn();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => ({})),
}));

vi.mock('@revealui/db/queries/users', () => ({
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
}));

const mockCreateMagicLink = vi.mocked(authServer.createMagicLink);
const mockVerifyMagicLink = vi.mocked(authServer.verifyMagicLink);
const mockCreateSession = vi.mocked(authServer.createSession);
const mockDeleteAllUserSessions = vi.mocked(authServer.deleteAllUserSessions);

function createJsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUserByEmail.mockResolvedValue(null);
});

// ============================================================================
// POST /api/auth/recovery/request
// ============================================================================

describe('POST /api/auth/recovery/request', () => {
  let handler: typeof import('../request/route').POST;

  beforeEach(async () => {
    const mod = await import('../request/route');
    handler = mod.POST;
  });

  it('should return 200 success for valid email with existing user', async () => {
    mockGetUserByEmail.mockResolvedValue({ id: 'user-123', email: 'test@example.com' });
    mockCreateMagicLink.mockResolvedValue({
      token: 'magic-token-abc',
      expiresAt: new Date(Date.now() + 900_000),
    });

    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/request', {
      email: 'test@example.com',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockCreateMagicLink).toHaveBeenCalledWith('user-123');
  });

  it('should return 200 success for unknown email (anti-enumeration)', async () => {
    // No user found — getUserByEmail returns null (default)

    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/request', {
      email: 'nobody@example.com',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // createMagicLink should NOT be called when user doesn't exist
    expect(mockCreateMagicLink).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid email format', async () => {
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/request', {
      email: 'not-an-email',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing email', async () => {
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/request', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for malformed JSON', async () => {
    const request = new NextRequest('http://localhost:4000/api/auth/recovery/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// POST /api/auth/recovery/verify
// ============================================================================

describe('POST /api/auth/recovery/verify', () => {
  let handler: typeof import('../verify/route').POST;

  beforeEach(async () => {
    const mod = await import('../verify/route');
    handler = mod.POST;
  });

  it('should create session on valid token', async () => {
    mockVerifyMagicLink.mockResolvedValue({ userId: 'user-456' });
    mockDeleteAllUserSessions.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue({
      token: 'recovery-session-token',
      session: { id: 'recovery-session-id' } as never,
    });

    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {
      token: 'valid-magic-link-token',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockVerifyMagicLink).toHaveBeenCalledWith('valid-magic-link-token');

    // Recovery must invalidate ALL existing sessions before creating a new one —
    // if the account is compromised, the attacker's active session must not survive.
    expect(mockDeleteAllUserSessions).toHaveBeenCalledWith('user-456');
    expect(mockCreateSession).toHaveBeenCalledWith(
      'user-456',
      expect.objectContaining({
        expiresAt: expect.any(Date),
        metadata: { recovery: true },
      }),
    );

    // Check session cookie was set
    const sessionCookie = response.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('recovery-session-token');
  });

  it('should return 401 for invalid token', async () => {
    mockVerifyMagicLink.mockResolvedValue(null);

    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {
      token: 'invalid-token',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('RECOVERY_INVALID');
  });

  it('should return 400 for empty token', async () => {
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {
      token: '',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing token field', async () => {
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for malformed JSON', async () => {
    const request = new NextRequest('http://localhost:4000/api/auth/recovery/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad json',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should set recovery session with 30-minute expiry', async () => {
    mockVerifyMagicLink.mockResolvedValue({ userId: 'user-789' });
    mockCreateSession.mockResolvedValue({
      token: 'recovery-token',
      session: { id: 'session-id' } as never,
    });

    const before = Date.now();
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {
      token: 'valid-token',
    });
    await handler(request);
    const after = Date.now();

    const sessionCall = mockCreateSession.mock.calls[0];
    const options = sessionCall?.[1] as { expiresAt: Date; metadata: Record<string, unknown> };
    const expiryMs = options.expiresAt.getTime();

    // Expiry should be ~30 minutes from now
    expect(expiryMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
    expect(expiryMs).toBeLessThanOrEqual(after + 30 * 60 * 1000);
    expect(options.metadata).toEqual({ recovery: true });
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Error handling', () => {
  it('should return 500 on unexpected error in request route', async () => {
    mockGetUserByEmail.mockRejectedValue(new Error('Database connection failed'));

    const { POST: requestHandler } = await import('../request/route');
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/request', {
      email: 'test@example.com',
    });
    const response = await requestHandler(request);

    expect(response.status).toBe(500);
  });

  it('should return 500 on unexpected error in verify route', async () => {
    mockVerifyMagicLink.mockRejectedValue(new Error('Token verification crashed'));

    const { POST: verifyHandler } = await import('../verify/route');
    const request = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {
      token: 'some-token',
    });
    const response = await verifyHandler(request);

    expect(response.status).toBe(500);
  });
});
