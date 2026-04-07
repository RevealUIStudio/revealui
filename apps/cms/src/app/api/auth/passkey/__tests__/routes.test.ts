/**
 * Passkey API Route Tests
 *
 * Tests all WebAuthn passkey API routes:
 * - POST /api/auth/passkey/register-options
 * - POST /api/auth/passkey/register-verify
 * - POST /api/auth/passkey/authenticate-options
 * - POST /api/auth/passkey/authenticate-verify
 * - GET  /api/auth/passkey/list
 * - PATCH /api/auth/passkey/:id
 * - DELETE /api/auth/passkey/:id
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the auth server
vi.mock('@revealui/auth/server', () => ({
  getSession: vi.fn(),
  generateRegistrationChallenge: vi.fn(),
  verifyRegistration: vi.fn(),
  storePasskey: vi.fn(),
  generateAuthenticationChallenge: vi.fn(),
  verifyAuthentication: vi.fn(),
  listPasskeys: vi.fn(),
  deletePasskey: vi.fn(),
  renamePasskey: vi.fn(),
  countUserCredentials: vi.fn(),
  signCookiePayload: vi.fn(),
  verifyCookiePayload: vi.fn(),
  createSession: vi.fn(),
  rotateSession: vi.fn(),
  initiateMFASetup: vi.fn(),
  verifyMFASetup: vi.fn(),
  checkRateLimit: vi.fn(),
  isRecoverySession: vi.fn().mockReturnValue(false),
  auditLoginSuccess: vi.fn(),
  auditLoginFailure: vi.fn(),
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

// Mock license module — tests run without a license server, so report no limit
vi.mock('@revealui/core/license', () => ({
  initializeLicense: vi.fn(() => Promise.resolve()),
  getMaxUsers: vi.fn(() => Infinity),
}));

// Mock the database client (both barrel and internal path for inlined resolution)
vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/client', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  users: { id: 'id', email: 'email', password: 'password' },
  passkeys: {
    id: 'id',
    userId: 'user_id',
    credentialId: 'credential_id',
    publicKey: 'public_key',
    counter: 'counter',
    transports: 'transports',
  },
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
  isNull: vi.fn((_col: unknown) => ({ type: 'isNull' })),
  count: vi.fn(() => ({ type: 'count' })),
  sql: (() => {
    const sqlFn = () => ({ sql: 'mock' });
    sqlFn.raw = vi.fn();
    return sqlFn;
  })(),
}));

// Mock database query builder
// biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible return types
type MockFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>;
interface MockDatabase {
  select: MockFn;
  from: MockFn;
  where: MockFn;
  limit: MockFn;
  insert: MockFn;
  values: MockFn;
  returning: MockFn;
  update: MockFn;
  set: MockFn;
  delete: MockFn;
}

const mockDb: MockDatabase = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  limit: vi.fn(() => Promise.resolve([])),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  returning: vi.fn(() => Promise.resolve([])),
  update: vi.fn(() => mockDb),
  set: vi.fn(() => mockDb),
  delete: vi.fn(() => mockDb),
};

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
const mockGenerateRegistrationChallenge = vi.mocked(authServer.generateRegistrationChallenge);
const mockVerifyRegistration = vi.mocked(authServer.verifyRegistration);
const mockStorePasskey = vi.mocked(authServer.storePasskey);
const mockGenerateAuthenticationChallenge = vi.mocked(authServer.generateAuthenticationChallenge);
const mockVerifyAuthentication = vi.mocked(authServer.verifyAuthentication);
const mockListPasskeys = vi.mocked(authServer.listPasskeys);
const mockDeletePasskey = vi.mocked(authServer.deletePasskey);
const mockRenamePasskey = vi.mocked(authServer.renamePasskey);
const mockSignCookiePayload = authServer.signCookiePayload as unknown as ReturnType<typeof vi.fn>;
const mockVerifyCookiePayload = authServer.verifyCookiePayload as unknown as ReturnType<
  typeof vi.fn
>;
const mockCreateSession = vi.mocked(authServer.createSession);
const mockRotateSession = vi.mocked(authServer.rotateSession);
const mockInitiateMFASetup = vi.mocked(authServer.initiateMFASetup);

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

function createGetRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      cookie: 'revealui-session=test-token',
    },
  });
}

function createChallengeRequest(url: string, body: unknown, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: 'passkey-challenge=signed-challenge-value',
    },
    body: JSON.stringify(body),
  });
}

function createAuthenticatedChallengeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: 'revealui-session=test-token; passkey-challenge=signed-challenge-value',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock DB chain
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.limit.mockResolvedValue([]);
  mockDb.insert.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.returning.mockResolvedValue([]);
  mockDb.update.mockReturnValue(mockDb);
  mockDb.set.mockReturnValue(mockDb);
  mockDb.delete.mockReturnValue(mockDb);
});

// ============================================================================
// POST /api/auth/passkey/register-options
// ============================================================================

describe('POST /api/auth/passkey/register-options', () => {
  let handler: typeof import('../register-options/route').POST;

  beforeEach(async () => {
    const mod = await import('../register-options/route');
    handler = mod.POST;
  }, 10_000);

  it('should return registration options for authenticated user', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockListPasskeys.mockResolvedValue([]);
    mockGenerateRegistrationChallenge.mockResolvedValue({
      challenge: 'test-challenge-base64',
      rp: { name: 'RevealUI', id: 'localhost' },
      user: { id: 'user-id', name: 'test@example.com', displayName: 'test@example.com' },
      pubKeyCredParams: [],
      timeout: 300000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    mockSignCookiePayload.mockReturnValue('signed-challenge');

    const request = createJsonRequest(
      'http://localhost:3000/api/auth/passkey/register-options',
      {},
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBe('test-challenge-base64');
    expect(mockGenerateRegistrationChallenge).toHaveBeenCalledWith(
      mockSession.user.id,
      mockSession.user.email,
      [],
    );

    // Check challenge cookie was set
    const challengeCookie = response.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('signed-challenge');
  });

  it('should return registration options for sign-up flow', async () => {
    mockGetSession.mockResolvedValue(null);
    mockDb.limit.mockResolvedValue([]); // No existing user
    mockGenerateRegistrationChallenge.mockResolvedValue({
      challenge: 'signup-challenge',
      rp: { name: 'RevealUI', id: 'localhost' },
      user: { id: 'temp-id', name: 'new@example.com', displayName: 'new@example.com' },
      pubKeyCredParams: [],
      timeout: 300000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    mockSignCookiePayload.mockReturnValue('signed-signup-challenge');

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/register-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', name: 'New User' }),
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBe('signup-challenge');
  });

  it('should reject sign-up when email is already taken', async () => {
    mockGetSession.mockResolvedValue(null);
    mockDb.limit.mockResolvedValue([{ id: 'existing-user-id' }]);

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/register-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'taken@example.com', name: 'User' }),
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('SIGNUP_FAILED');
  });

  it('should reject sign-up without email and name', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/register-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// POST /api/auth/passkey/register-verify
// ============================================================================

describe('POST /api/auth/passkey/register-verify', () => {
  let handler: typeof import('../register-verify/route').POST;

  beforeEach(async () => {
    const mod = await import('../register-verify/route');
    handler = mod.POST;
  }, 10_000);

  it('should return 401 when challenge cookie is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/passkey/register-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attestationResponse: {} }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return 401 when challenge cookie is expired', async () => {
    mockVerifyCookiePayload.mockReturnValue(null);

    const request = createChallengeRequest(
      'http://localhost:3000/api/auth/passkey/register-verify',
      { attestationResponse: { id: 'cred-id', response: {} } },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should store credential for authenticated user', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'test-challenge',
      userId: mockSession.user.id,
      expiresAt: Date.now() + 300000,
    });
    mockGetSession.mockResolvedValue(mockSession);
    mockVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'new-credential-id',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
        credentialType: 'public-key',
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        attestationObject: new Uint8Array(),
        origin: 'http://localhost:4000',
      },
    });
    mockStorePasskey.mockResolvedValue({
      id: 'passkey-id',
      userId: mockSession.user.id,
      credentialId: 'new-credential-id',
      deviceName: 'Test Device',
      createdAt: new Date(),
    });

    const request = createAuthenticatedChallengeRequest(
      'http://localhost:3000/api/auth/passkey/register-verify',
      {
        attestationResponse: { id: 'cred-id', response: {} },
        deviceName: 'Test Device',
      },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockStorePasskey).toHaveBeenCalledWith(
      mockSession.user.id,
      expect.objectContaining({ id: 'new-credential-id' }),
      'Test Device',
    );

    // Challenge cookie should be cleared
    const challengeCookie = response.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('');
  });

  it('should create user + session for sign-up flow', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'signup-challenge',
      userId: 'temp-user-id',
      email: 'new@example.com',
      name: 'New User',
      expiresAt: Date.now() + 300000,
    });
    mockDb.limit.mockResolvedValue([]); // No existing user
    mockDb.returning.mockResolvedValue([
      {
        id: 'new-user-id',
        email: 'new@example.com',
        name: 'New User',
        password: null,
      },
    ]);
    mockVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'signup-credential-id',
          publicKey: new Uint8Array([4, 5, 6]),
          counter: 0,
          transports: ['internal'],
        },
        credentialType: 'public-key',
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        attestationObject: new Uint8Array(),
        origin: 'http://localhost:4000',
      },
    });
    mockStorePasskey.mockResolvedValue({
      id: 'passkey-id',
      userId: 'new-user-id',
      credentialId: 'signup-credential-id',
      deviceName: null,
      createdAt: new Date(),
    });
    mockInitiateMFASetup.mockResolvedValue({
      success: true,
      secret: 'TOTP_SECRET',
      uri: 'otpauth://totp/RevealUI:new@example.com',
      backupCodes: ['backup1', 'backup2', 'backup3'],
    });
    mockCreateSession.mockResolvedValue({
      token: 'new-session-token',
      session: { id: 'new-session-id' } as never,
    });

    const request = createChallengeRequest(
      'http://localhost:3000/api/auth/passkey/register-verify',
      { attestationResponse: { id: 'cred-id', response: {} } },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('new@example.com');
    expect(data.backupCodes).toEqual(['backup1', 'backup2', 'backup3']);

    // Session cookie should be set
    const sessionCookie = response.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('new-session-token');

    // Challenge cookie should be cleared
    const challengeCookie = response.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('');
  });

  it('should reject sign-up when email is taken (race condition)', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'signup-challenge',
      userId: 'temp-user-id',
      email: 'taken@example.com',
      name: 'User',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'cred-id',
          publicKey: new Uint8Array([1]),
          counter: 0,
        },
        credentialType: 'public-key',
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        attestationObject: new Uint8Array(),
        origin: 'http://localhost:4000',
      },
    });
    mockDb.limit.mockResolvedValue([{ id: 'existing-user-id' }]);

    const request = createChallengeRequest(
      'http://localhost:3000/api/auth/passkey/register-verify',
      { attestationResponse: { id: 'cred-id', response: {} } },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('SIGNUP_FAILED');
  });
});

// ============================================================================
// POST /api/auth/passkey/authenticate-options
// ============================================================================

describe('POST /api/auth/passkey/authenticate-options', () => {
  let handler: typeof import('../authenticate-options/route').POST;

  beforeEach(async () => {
    const mod = await import('../authenticate-options/route');
    handler = mod.POST;
  }, 10_000);

  it('should return authentication options and set challenge cookie', async () => {
    mockGenerateAuthenticationChallenge.mockResolvedValue({
      challenge: 'auth-challenge-base64',
      rpId: 'localhost',
      timeout: 300000,
      userVerification: 'preferred',
    });
    mockSignCookiePayload.mockReturnValue('signed-auth-challenge');

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/authenticate-options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.options).toBeDefined();
    expect(data.options.challenge).toBe('auth-challenge-base64');

    const challengeCookie = response.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('signed-auth-challenge');
  });
});

// ============================================================================
// POST /api/auth/passkey/authenticate-verify
// ============================================================================

describe('POST /api/auth/passkey/authenticate-verify', () => {
  let handler: typeof import('../authenticate-verify/route').POST;

  beforeEach(async () => {
    const mod = await import('../authenticate-verify/route');
    handler = mod.POST;
  }, 10_000);

  it('should return 401 when challenge cookie is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/passkey/authenticate-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authenticationResponse: {} }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should verify authentication and create session (no TOTP)', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'auth-challenge',
      expiresAt: Date.now() + 300000,
    });

    // Mock: look up passkey by credential ID
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'passkey-db-id',
        userId: 'user-123',
        credentialId: 'stored-cred-id',
        publicKey: Buffer.from([1, 2, 3]),
        counter: 5,
        transports: ['internal'],
      },
    ]);

    // Mock: look up user
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Passkey User',
        avatarUrl: null,
        role: 'viewer',
      },
    ]);

    mockVerifyAuthentication.mockResolvedValue({
      verified: true,
      newCounter: 6,
    });

    mockRotateSession.mockResolvedValue({
      token: 'passkey-session-token',
      session: { id: 'passkey-session-id' } as never,
    });

    const request = createChallengeRequest(
      'http://localhost:3000/api/auth/passkey/authenticate-verify',
      {
        authenticationResponse: {
          id: 'stored-cred-id',
          rawId: 'raw-id',
          response: { authenticatorData: 'data', clientDataJSON: 'json', signature: 'sig' },
          type: 'public-key',
        },
      },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('user@example.com');
    expect(mockVerifyAuthentication).toHaveBeenCalled();
    expect(mockRotateSession).toHaveBeenCalledWith('user-123', expect.any(Object));

    // Session cookie should be set
    const sessionCookie = response.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('passkey-session-token');

    // Challenge cookie should be cleared
    const challengeCookie = response.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('');
  });

  it('should return 401 when passkey is not recognized', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'auth-challenge',
      expiresAt: Date.now() + 300000,
    });
    mockDb.limit.mockResolvedValue([]); // No matching passkey

    const request = createChallengeRequest(
      'http://localhost:3000/api/auth/passkey/authenticate-verify',
      {
        authenticationResponse: {
          id: 'unknown-cred-id',
          rawId: 'raw-id',
          response: {},
          type: 'public-key',
        },
      },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('PASSKEY_NOT_FOUND');
  });

  it('should return 401 when verification fails', async () => {
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'auth-challenge',
      expiresAt: Date.now() + 300000,
    });

    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'passkey-db-id',
        userId: 'user-123',
        credentialId: 'stored-cred-id',
        publicKey: Buffer.from([1, 2, 3]),
        counter: 5,
        transports: ['internal'],
      },
    ]);
    mockDb.limit.mockResolvedValueOnce([
      { id: 'user-123', email: 'user@example.com', name: 'User', role: 'viewer' },
    ]);

    mockVerifyAuthentication.mockResolvedValue({
      verified: false,
      newCounter: 5,
    });

    const request = createChallengeRequest(
      'http://localhost:3000/api/auth/passkey/authenticate-verify',
      {
        authenticationResponse: {
          id: 'stored-cred-id',
          rawId: 'raw-id',
          response: {},
          type: 'public-key',
        },
      },
    );
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('PASSKEY_VERIFY_FAILED');
  });
});

// ============================================================================
// GET /api/auth/passkey/list
// ============================================================================

describe('GET /api/auth/passkey/list', () => {
  let handler: typeof import('../list/route').GET;

  beforeEach(async () => {
    const mod = await import('../list/route');
    handler = mod.GET;
  }, 10_000);

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createGetRequest('http://localhost:3000/api/auth/passkey/list');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should return passkeys for authenticated user', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockListPasskeys.mockResolvedValue([
      {
        id: 'pk-1',
        credentialId: 'cred-1',
        deviceName: 'MacBook Pro',
        backedUp: true,
        createdAt: new Date('2026-01-01'),
        lastUsedAt: new Date('2026-03-01'),
      },
      {
        id: 'pk-2',
        credentialId: 'cred-2',
        deviceName: null,
        backedUp: false,
        createdAt: new Date('2026-02-01'),
        lastUsedAt: null,
      },
    ]);

    const request = createGetRequest('http://localhost:3000/api/auth/passkey/list');
    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.passkeys).toHaveLength(2);
    expect(data.passkeys[0].deviceName).toBe('MacBook Pro');
    expect(mockListPasskeys).toHaveBeenCalledWith(mockSession.user.id);
  });
});

// ============================================================================
// PATCH /api/auth/passkey/:id
// ============================================================================

describe('PATCH /api/auth/passkey/:id', () => {
  let handler: typeof import('../[id]/route').PATCH;

  beforeEach(async () => {
    const mod = await import('../[id]/route');
    handler = mod.PATCH;
  }, 10_000);

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = createJsonRequest(
      'http://localhost:3000/api/auth/passkey/pk-1',
      { deviceName: 'New Name' },
      'PATCH',
    );
    const response = await handler(request, { params: Promise.resolve({ id: 'pk-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should rename a passkey', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockRenamePasskey.mockResolvedValue(undefined);

    const request = createJsonRequest(
      'http://localhost:3000/api/auth/passkey/pk-1',
      { deviceName: 'iPhone 16 Pro' },
      'PATCH',
    );
    const response = await handler(request, { params: Promise.resolve({ id: 'pk-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockRenamePasskey).toHaveBeenCalledWith(mockSession.user.id, 'pk-1', 'iPhone 16 Pro');
  });

  it('should return 400 on validation error (empty device name)', async () => {
    mockGetSession.mockResolvedValue(mockSession);

    const request = createJsonRequest(
      'http://localhost:3000/api/auth/passkey/pk-1',
      { deviceName: '' },
      'PATCH',
    );
    const response = await handler(request, { params: Promise.resolve({ id: 'pk-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('VALIDATION_ERROR');
  });
});

// ============================================================================
// DELETE /api/auth/passkey/:id
// ============================================================================

describe('DELETE /api/auth/passkey/:id', () => {
  let handler: typeof import('../[id]/route').DELETE;

  beforeEach(async () => {
    const mod = await import('../[id]/route');
    handler = mod.DELETE;
  }, 10_000);

  it('should return 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/pk-1', {
      method: 'DELETE',
      headers: { cookie: 'revealui-session=test-token' },
    });
    const response = await handler(request, { params: Promise.resolve({ id: 'pk-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should delete a passkey', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockDeletePasskey.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/pk-1', {
      method: 'DELETE',
      headers: { cookie: 'revealui-session=test-token' },
    });
    const response = await handler(request, { params: Promise.resolve({ id: 'pk-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeletePasskey).toHaveBeenCalledWith(mockSession.user.id, 'pk-1');
  });

  it('should return 400 when deleting last sign-in method', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockDeletePasskey.mockRejectedValue(new Error('Cannot delete last sign-in method'));

    const request = new NextRequest('http://localhost:3000/api/auth/passkey/pk-1', {
      method: 'DELETE',
      headers: { cookie: 'revealui-session=test-token' },
    });
    const response = await handler(request, { params: Promise.resolve({ id: 'pk-1' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('PASSKEY_DELETE_BLOCKED');
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe('Error handling', () => {
  it('should return 500 on unexpected error in register-options', async () => {
    mockGetSession.mockRejectedValue(new Error('Database connection failed'));

    const { POST: registerHandler } = await import('../register-options/route');
    const request = createJsonRequest(
      'http://localhost:3000/api/auth/passkey/register-options',
      {},
    );
    const response = await registerHandler(request);

    expect(response.status).toBe(500);
  });

  it('should return 500 on unexpected error in authenticate-options', async () => {
    mockGenerateAuthenticationChallenge.mockRejectedValue(new Error('Crypto failure'));

    const { POST: authHandler } = await import('../authenticate-options/route');
    const request = new NextRequest('http://localhost:3000/api/auth/passkey/authenticate-options', {
      method: 'POST',
    });
    const response = await authHandler(request);

    expect(response.status).toBe(500);
  });

  it('should return 500 on unexpected error in list', async () => {
    mockGetSession.mockRejectedValue(new Error('Database connection failed'));

    const { GET: listHandler } = await import('../list/route');
    const request = createGetRequest('http://localhost:3000/api/auth/passkey/list');
    const response = await listHandler(request);

    expect(response.status).toBe(500);
  });
});
