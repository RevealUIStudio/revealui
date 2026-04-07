/**
 * MFA API Route Tests
 *
 * Tests all 7 TOTP MFA API routes:
 * - POST /api/auth/mfa/setup
 * - POST /api/auth/mfa/verify-setup
 * - POST /api/auth/mfa/verify
 * - POST /api/auth/mfa/backup
 * - POST /api/auth/mfa/disable
 * - POST /api/auth/mfa/regenerate
 * - GET  /api/auth/mfa/status
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the auth server
vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  initiateMFASetup: vi.fn(),
  verifyMFASetup: vi.fn(),
  verifyMFACode: vi.fn(),
  verifyBackupCode: vi.fn(),
  disableMFA: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  isMFAEnabled: vi.fn(),
  createSession: vi.fn(),
  rotateSession: vi.fn(),
  verifyCookiePayload: vi.fn(),
  verifyAuthentication: vi.fn(),
  checkRateLimit: vi.fn(),
  isRecoverySession: vi.fn().mockReturnValue(false),
  auditMfaEnabled: vi.fn(),
  auditMfaDisabled: vi.fn(),
  auditLoginSuccess: vi.fn(),
}));

// biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible return types
type MockFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>;
interface MockDatabase {
  select: MockFn;
  from: MockFn;
  where: MockFn;
  limit: MockFn;
}

const mockDb: MockDatabase = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  limit: vi.fn(() => Promise.resolve([])),
};

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  passkeys: {
    credentialId: 'credential_id',
    userId: 'user_id',
    publicKey: 'public_key',
    counter: 'counter',
    transports: 'transports',
  },
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
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

const mockSession = {
  session: {
    id: 'session-abc-123',
    userId: '123e4567-e89b-12d3-a456-426614174000',
    schemaVersion: '1',
    tokenHash: 'token-hash',
    expiresAt: new Date(Date.now() + 86400000),
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    persistent: false,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    metadata: null,
  },
  user: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    schemaVersion: '1',
    type: 'human',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: null,
    password: null,
    role: 'viewer',
    status: 'active',
    emailVerified: false,
    emailVerificationToken: null,
    emailVerifiedAt: null,
    mfaEnabled: false,
    mfaVerifiedAt: null,
    agentModel: null,
    agentCapabilities: null,
    agentConfig: null,
    preferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: null,
  },
};

const mockGetSession = vi.mocked(authServer.getSession);
const mockInitiateMFASetup = vi.mocked(authServer.initiateMFASetup);
const mockVerifyMFASetup = vi.mocked(authServer.verifyMFASetup);
const mockVerifyMFACode = vi.mocked(authServer.verifyMFACode);
const mockVerifyBackupCode = vi.mocked(authServer.verifyBackupCode);
const mockDisableMFA = vi.mocked(authServer.disableMFA);
const mockRegenerateBackupCodes = vi.mocked(authServer.regenerateBackupCodes);
const mockIsMFAEnabled = vi.mocked(authServer.isMFAEnabled);
const mockRotateSession = vi.mocked(authServer.rotateSession);
const mockVerifyAuthentication = vi.mocked(authServer.verifyAuthentication);
// verifyCookiePayload is generic — use vi.fn() cast to avoid excess property errors
const mockVerifyCookiePayload = authServer.verifyCookiePayload as unknown as ReturnType<
  typeof vi.fn
>;

function createJsonRequest(url: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: 'revealui-session=test-token',
    },
    body: JSON.stringify(body),
  });
}

function createJsonRequestWithPasskeyChallenge(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'revealui-session=test-token; passkey-challenge=signed-challenge-cookie',
    },
    body: JSON.stringify(body),
  });
}

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      cookie: 'revealui-session=test-token',
    },
  });
}

function createMfaPendingRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'mfa-pending=signed-cookie-value',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// POST /api/auth/mfa/setup
// ============================================================================

describe('POST /api/auth/mfa/setup', () => {
  let handler: typeof import('../setup/route').POST;

  beforeEach(async () => {
    const mod = await import('../setup/route');
    handler = mod.POST;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/setup', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return setup data on success', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockInitiateMFASetup.mockResolvedValue({
      success: true,
      secret: 'JBSWY3DPEHPK3PXP',
      uri: 'otpauth://totp/RevealUI:test@example.com?secret=JBSWY3DPEHPK3PXP',
      backupCodes: ['code1', 'code2', 'code3'],
    });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/setup', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(data.uri).toContain('otpauth://totp/');
    expect(data.backupCodes).toHaveLength(3);
    expect(mockInitiateMFASetup).toHaveBeenCalledWith(mockSession.user.id, mockSession.user.email);
  });

  it('should return 400 when MFA is already enabled', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockInitiateMFASetup.mockResolvedValue({
      success: false,
      error: 'MFA is already enabled',
    });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/setup', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('MFA_SETUP_FAILED');
  });
});

// ============================================================================
// POST /api/auth/mfa/verify-setup
// ============================================================================

describe('POST /api/auth/mfa/verify-setup', () => {
  let handler: typeof import('../verify-setup/route').POST;

  beforeEach(async () => {
    const mod = await import('../verify-setup/route');
    handler = mod.POST;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/verify-setup', {
      code: '123456',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return success on valid TOTP code', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyMFASetup.mockResolvedValue({ success: true });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/verify-setup', {
      code: '123456',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockVerifyMFASetup).toHaveBeenCalledWith(mockSession.user.id, '123456');
  });

  it('should return 400 on invalid code', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyMFASetup.mockResolvedValue({
      success: false,
      error: 'Invalid verification code',
    });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/verify-setup', {
      code: '000000',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('MFA_VERIFY_FAILED');
  });

  it('should return 400 on validation error (non-numeric code)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/verify-setup', {
      code: 'abcdef',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });

  it('should return 400 on validation error (wrong length)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/verify-setup', {
      code: '12345',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// POST /api/auth/mfa/verify
// ============================================================================

describe('POST /api/auth/mfa/verify', () => {
  let handler: typeof import('../verify/route').POST;

  beforeEach(async () => {
    const mod = await import('../verify/route');
    handler = mod.POST;
  });

  it('should return 401 when mfa-pending cookie is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return 401 when mfa-pending cookie is expired/invalid', async () => {
    mockVerifyCookiePayload.mockReturnValue(null);

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/verify', {
      code: '123456',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should create session on valid TOTP code', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-123',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyMFACode.mockResolvedValue({ success: true });
    mockRotateSession.mockResolvedValue({
      token: 'new-session-token',
      session: { id: 'new-session-id' } as never,
    });

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/verify', {
      code: '123456',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockVerifyMFACode).toHaveBeenCalledWith('user-123', '123456');
    expect(mockRotateSession).toHaveBeenCalledWith('user-123', expect.any(Object));

    // Check session cookie was set
    const sessionCookie = response.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('new-session-token');

    // Check mfa-pending cookie was cleared
    const mfaCookie = response.cookies.get('mfa-pending');
    expect(mfaCookie?.value).toBe('');
  });

  it('should return 401 on invalid TOTP code', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-123',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyMFACode.mockResolvedValue({
      success: false,
      error: 'Invalid code',
    });

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/verify', {
      code: '000000',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('MFA_VERIFY_FAILED');
  });

  it('should return 400 on validation error', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-123',
      expiresAt: Date.now() + 300000,
    });

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/verify', {
      code: 'abc',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// POST /api/auth/mfa/backup
// ============================================================================

describe('POST /api/auth/mfa/backup', () => {
  let handler: typeof import('../backup/route').POST;

  beforeEach(async () => {
    const mod = await import('../backup/route');
    handler = mod.POST;
  });

  it('should return 401 when mfa-pending cookie is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/mfa/backup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abcdef1234' }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return 401 when mfa-pending cookie is expired/invalid', async () => {
    mockVerifyCookiePayload.mockReturnValue(null);

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/backup', {
      code: 'abcdef1234',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should create session on valid backup code', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-123',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyBackupCode.mockResolvedValue({
      success: true,
      remainingCodes: 7,
    });
    mockRotateSession.mockResolvedValue({
      token: 'new-session-token',
      session: { id: 'new-session-id' } as never,
    });

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/backup', {
      code: 'abcdef1234',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.remainingCodes).toBe(7);
    expect(mockVerifyBackupCode).toHaveBeenCalledWith('user-123', 'abcdef1234');
    expect(mockRotateSession).toHaveBeenCalledWith('user-123', expect.any(Object));

    // Check session cookie was set
    const sessionCookie = response.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('new-session-token');

    // Check mfa-pending cookie was cleared
    const mfaCookie = response.cookies.get('mfa-pending');
    expect(mfaCookie?.value).toBe('');
  });

  it('should return 401 on invalid backup code', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-123',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyBackupCode.mockResolvedValue({
      success: false,
      error: 'Invalid backup code',
    });

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/backup', {
      code: 'invalid12345',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('MFA_BACKUP_FAILED');
  });

  it('should return 400 on validation error (code too short)', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-123',
      expiresAt: Date.now() + 300000,
    });

    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/backup', {
      code: 'ab',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// POST /api/auth/mfa/disable
// ============================================================================

describe('POST /api/auth/mfa/disable', () => {
  let handler: typeof import('../disable/route').POST;

  beforeEach(async () => {
    const mod = await import('../disable/route');
    handler = mod.POST;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/disable', {
      method: 'password',
      password: 'test',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should disable MFA with password proof', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockDisableMFA.mockResolvedValue({ success: true });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/disable', {
      method: 'password',
      password: 'correct-password',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDisableMFA).toHaveBeenCalledWith(mockSession.user.id, {
      method: 'password',
      password: 'correct-password',
    });
  });

  it('should disable MFA with passkey proof', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'test-challenge',
      expiresAt: Date.now() + 60_000,
    });
    mockDb.limit.mockResolvedValue([
      {
        credentialId: 'cred-id',
        userId: mockSession.user.id,
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        transports: null,
      },
    ]);
    mockVerifyAuthentication.mockResolvedValue({ verified: true, newCounter: 1 });
    mockDisableMFA.mockResolvedValue({ success: true });

    const request = createJsonRequestWithPasskeyChallenge(
      'http://localhost:3000/api/auth/mfa/disable',
      { method: 'passkey', authenticationResponse: { id: 'cred-id', response: {} } },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDisableMFA).toHaveBeenCalledWith(mockSession.user.id, {
      method: 'passkey',
      verified: true,
    });
  });

  it('should return 400 when password is wrong', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockDisableMFA.mockResolvedValue({
      success: false,
      error: 'Invalid password',
    });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/disable', {
      method: 'password',
      password: 'wrong',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('MFA_DISABLE_FAILED');
  });

  it('should return 400 on validation error (missing method)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/disable', {
      password: 'test',
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// POST /api/auth/mfa/regenerate
// ============================================================================

describe('POST /api/auth/mfa/regenerate', () => {
  let handler: typeof import('../regenerate/route').POST;

  beforeEach(async () => {
    const mod = await import('../regenerate/route');
    handler = mod.POST;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/regenerate', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return new backup codes on success', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockRegenerateBackupCodes.mockResolvedValue({
      success: true,
      backupCodes: ['newcode1', 'newcode2', 'newcode3'],
    });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/regenerate', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.backupCodes).toEqual(['newcode1', 'newcode2', 'newcode3']);
    expect(mockRegenerateBackupCodes).toHaveBeenCalledWith(mockSession.user.id);
  });

  it('should return 400 when MFA is not enabled', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockRegenerateBackupCodes.mockResolvedValue({
      success: false,
      error: 'MFA not enabled',
    });

    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/regenerate', {});
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('MFA_REGENERATE_FAILED');
  });
});

// ============================================================================
// GET /api/auth/mfa/status
// ============================================================================

describe('GET /api/auth/mfa/status', () => {
  let handler: typeof import('../status/route').GET;

  beforeEach(async () => {
    const mod = await import('../status/route');
    handler = mod.GET;
  });

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createGetRequest('http://localhost:3000/api/auth/mfa/status');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return enabled: true when MFA is enabled', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockIsMFAEnabled.mockResolvedValue(true);

    const request = createGetRequest('http://localhost:3000/api/auth/mfa/status');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabled).toBe(true);
    expect(mockIsMFAEnabled).toHaveBeenCalledWith(mockSession.user.id);
  });

  it('should return enabled: false when MFA is not enabled', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockIsMFAEnabled.mockResolvedValue(false);

    const request = createGetRequest('http://localhost:3000/api/auth/mfa/status');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.enabled).toBe(false);
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Error handling', () => {
  it('should return 500 on unexpected error in setup', async () => {
    mockGetSession.mockRejectedValue(new Error('Database connection failed'));

    const { POST: setupHandler } = await import('../setup/route');
    const request = createJsonRequest('http://localhost:3000/api/auth/mfa/setup', {});
    const response = await setupHandler(request);

    expect(response.status).toBe(500);
  });

  it('should return 500 on unexpected error in status', async () => {
    mockGetSession.mockRejectedValue(new Error('Database connection failed'));

    const { GET: statusHandler } = await import('../status/route');
    const request = createGetRequest('http://localhost:3000/api/auth/mfa/status');
    const response = await statusHandler(request);

    expect(response.status).toBe(500);
  });

  it('should return 500 on unexpected error in verify', async () => {
    mockVerifyCookiePayload.mockImplementation(() => {
      throw new Error('Crypto failure');
    });

    const { POST: verifyHandler } = await import('../verify/route');
    const request = createMfaPendingRequest('http://localhost:3000/api/auth/mfa/verify', {
      code: '123456',
    });
    const response = await verifyHandler(request);

    expect(response.status).toBe(500);
  });
});
