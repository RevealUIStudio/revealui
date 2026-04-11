/**
 * Auth Integration Tests
 *
 * Tests complete multi-step auth flows by chaining route handler calls:
 * 1. Password + TOTP flow
 * 2. Password + backup code flow
 * 3. Passkey sign-up flow
 * 4. Passkey sign-in flow
 * 5. Passkey management flow
 * 6. Magic link recovery flow
 * 7. MFA disable with passkey re-auth
 * 8. Edge cases (expired cookies, passkey limits)
 */

import * as authServer from '@revealui/auth/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@revealui/auth/server', () => ({
  signIn: vi.fn(),
  getSession: vi.fn(),
  createSession: vi.fn(),
  rotateSession: vi.fn(),
  deleteAllUserSessions: vi.fn(),
  verifyCookiePayload: vi.fn(),
  signCookiePayload: vi.fn(),
  verifyMFACode: vi.fn(),
  verifyBackupCode: vi.fn(),
  initiateMFASetup: vi.fn(),
  verifyMFASetup: vi.fn(),
  disableMFA: vi.fn(),
  isMFAEnabled: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  generateRegistrationChallenge: vi.fn(),
  verifyRegistration: vi.fn(),
  storePasskey: vi.fn(),
  generateAuthenticationChallenge: vi.fn(),
  verifyAuthentication: vi.fn(),
  listPasskeys: vi.fn(),
  deletePasskey: vi.fn(),
  renamePasskey: vi.fn(),
  countUserCredentials: vi.fn(),
  createMagicLink: vi.fn(),
  verifyMagicLink: vi.fn(),
  checkRateLimit: vi.fn(),
  isRecoverySession: vi.fn().mockReturnValue(false),
}));

vi.mock('@revealui/core/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  withRateLimit: vi.fn((handler: (request: NextRequest) => Promise<Response>) => handler),
}));

// Mock the email module  -  avoids real email provider initialization in tests
vi.mock('@/lib/email', () => ({
  sendRecoveryEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock license module  -  tests run without a license server, so report no limit
vi.mock('@revealui/core/license', () => ({
  initializeLicense: vi.fn(() => Promise.resolve()),
  getMaxUsers: vi.fn(() => Infinity),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
  isNull: vi.fn((_col: unknown) => ({ type: 'isNull' })),
  count: vi.fn(() => ({ type: 'count' })),
}));

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
}));

// ---------------------------------------------------------------------------
// Mock accessors
// ---------------------------------------------------------------------------

const mockSignIn = vi.mocked(authServer.signIn);
const mockGetSession = vi.mocked(authServer.getSession);
const mockCreateSession = vi.mocked(authServer.createSession);
const mockRotateSession = vi.mocked(authServer.rotateSession);
const mockVerifyCookiePayload = authServer.verifyCookiePayload as unknown as ReturnType<
  typeof vi.fn
>;
const mockSignCookiePayload = authServer.signCookiePayload as unknown as ReturnType<typeof vi.fn>;
const mockVerifyMFACode = vi.mocked(authServer.verifyMFACode);
const mockVerifyBackupCode = vi.mocked(authServer.verifyBackupCode);
const mockDisableMFA = vi.mocked(authServer.disableMFA);
const mockGenerateRegistrationChallenge = vi.mocked(authServer.generateRegistrationChallenge);
const mockVerifyRegistration = vi.mocked(authServer.verifyRegistration);
const mockStorePasskey = vi.mocked(authServer.storePasskey);
const mockGenerateAuthenticationChallenge = vi.mocked(authServer.generateAuthenticationChallenge);
const mockVerifyAuthentication = vi.mocked(authServer.verifyAuthentication);
const mockListPasskeys = vi.mocked(authServer.listPasskeys);
const mockDeletePasskey = vi.mocked(authServer.deletePasskey);
const mockRenamePasskey = vi.mocked(authServer.renamePasskey);
const mockInitiateMFASetup = vi.mocked(authServer.initiateMFASetup);
const mockCreateMagicLink = vi.mocked(authServer.createMagicLink);
const mockVerifyMagicLink = vi.mocked(authServer.verifyMagicLink);

// ---------------------------------------------------------------------------
// Session fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function createJsonRequest(
  url: string,
  body: unknown,
  options: { method?: string; cookies?: Record<string, string> } = {},
): NextRequest {
  const { method = 'POST', cookies = {} } = options;
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  return new NextRequest(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function createGetRequest(url: string, cookies: Record<string, string> = {}): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  return new NextRequest(url, { method: 'GET', headers });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

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
// 1. Password + TOTP flow
// ============================================================================

describe('Flow 1: Password + TOTP', () => {
  it('should sign in with password, then complete MFA via TOTP', { timeout: 15_000 }, async () => {
    // --- Step 1: Sign in with password, MFA required ---
    mockSignIn.mockResolvedValue({
      success: true,
      requiresMfa: true,
      mfaUserId: 'user-mfa-123',
    });
    mockSignCookiePayload.mockReturnValue('signed-mfa-pending-cookie');

    const { POST: signInHandler } = await import('../sign-in/route');
    const signInRequest = createJsonRequest('http://localhost:4000/api/auth/sign-in', {
      email: 'test@example.com',
      password: 'SecureP@ssw0rd!',
    });
    const signInResponse = await signInHandler(signInRequest);
    const signInData = await signInResponse.json();

    expect(signInResponse.status).toBe(200);
    expect(signInData.requiresMfa).toBe(true);

    // Verify mfa-pending cookie was set
    const mfaPendingCookie = signInResponse.cookies.get('mfa-pending');
    expect(mfaPendingCookie?.value).toBe('signed-mfa-pending-cookie');

    // --- Step 2: Verify TOTP code using mfa-pending cookie ---
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-mfa-123',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyMFACode.mockResolvedValue({ success: true });
    mockRotateSession.mockResolvedValue({
      token: 'full-session-token',
      session: { id: 'full-session-id' } as never,
    });

    const { POST: mfaVerifyHandler } = await import('../mfa/verify/route');
    const mfaVerifyRequest = createJsonRequest(
      'http://localhost:4000/api/auth/mfa/verify',
      {
        code: '123456',
      },
      { cookies: { 'mfa-pending': mfaPendingCookie!.value } },
    );
    const mfaVerifyResponse = await mfaVerifyHandler(mfaVerifyRequest);
    const mfaVerifyData = await mfaVerifyResponse.json();

    expect(mfaVerifyResponse.status).toBe(200);
    expect(mfaVerifyData.success).toBe(true);

    // Session cookie was set
    const sessionCookie = mfaVerifyResponse.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('full-session-token');

    // MFA-pending cookie was cleared
    const clearedMfaCookie = mfaVerifyResponse.cookies.get('mfa-pending');
    expect(clearedMfaCookie?.value).toBe('');

    // Verify the chain of calls
    expect(mockSignIn).toHaveBeenCalledWith(
      'test@example.com',
      'SecureP@ssw0rd!',
      expect.any(Object),
    );
    expect(mockVerifyMFACode).toHaveBeenCalledWith('user-mfa-123', '123456');
    expect(mockRotateSession).toHaveBeenCalledWith('user-mfa-123', expect.any(Object));
  });
});

// ============================================================================
// 2. Password + backup code flow
// ============================================================================

describe('Flow 2: Password + backup code', () => {
  it('should sign in with password, then complete MFA via backup code', {
    timeout: 15_000,
  }, async () => {
    // --- Step 1: Sign in with password, MFA required ---
    mockSignIn.mockResolvedValue({
      success: true,
      requiresMfa: true,
      mfaUserId: 'user-mfa-456',
    });
    mockSignCookiePayload.mockReturnValue('signed-mfa-pending-backup');

    const { POST: signInHandler } = await import('../sign-in/route');
    const signInRequest = createJsonRequest('http://localhost:4000/api/auth/sign-in', {
      email: 'backup-user@example.com',
      password: 'Str0ngP@ss!',
    });
    const signInResponse = await signInHandler(signInRequest);
    const signInData = await signInResponse.json();

    expect(signInResponse.status).toBe(200);
    expect(signInData.requiresMfa).toBe(true);

    const mfaPendingCookie = signInResponse.cookies.get('mfa-pending');
    expect(mfaPendingCookie?.value).toBe('signed-mfa-pending-backup');

    // --- Step 2: Verify backup code using mfa-pending cookie ---
    mockVerifyCookiePayload.mockReturnValue({
      userId: 'user-mfa-456',
      expiresAt: Date.now() + 300000,
    });
    mockVerifyBackupCode.mockResolvedValue({
      success: true,
      remainingCodes: 7,
    });
    mockRotateSession.mockResolvedValue({
      token: 'backup-session-token',
      session: { id: 'backup-session-id' } as never,
    });

    const { POST: backupHandler } = await import('../mfa/backup/route');
    const backupRequest = createJsonRequest(
      'http://localhost:4000/api/auth/mfa/backup',
      {
        code: 'abcdef1234',
      },
      { cookies: { 'mfa-pending': mfaPendingCookie!.value } },
    );
    const backupResponse = await backupHandler(backupRequest);
    const backupData = await backupResponse.json();

    expect(backupResponse.status).toBe(200);
    expect(backupData.success).toBe(true);
    expect(backupData.remainingCodes).toBe(7);

    // Session cookie was set
    const sessionCookie = backupResponse.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('backup-session-token');

    // MFA-pending cookie was cleared
    const clearedMfaCookie = backupResponse.cookies.get('mfa-pending');
    expect(clearedMfaCookie?.value).toBe('');

    // Verify the chain: backup code was consumed for the correct user
    expect(mockVerifyBackupCode).toHaveBeenCalledWith('user-mfa-456', 'abcdef1234');
    expect(mockRotateSession).toHaveBeenCalledWith('user-mfa-456', expect.any(Object));
  });
});

// ============================================================================
// 3. Passkey sign-up flow
// ============================================================================

describe('Flow 3: Passkey sign-up', () => {
  it('should register a new account with a passkey and return backup codes', async () => {
    // --- Step 1: Request registration options (unauthenticated, sign-up) ---
    mockGetSession.mockResolvedValue(null);
    mockDb.limit.mockResolvedValue([]); // No existing user with that email
    mockGenerateRegistrationChallenge.mockResolvedValue({
      challenge: 'signup-challenge-b64',
      rp: { name: 'RevealUI', id: 'localhost' },
      user: { id: 'temp-user-id', name: 'new@example.com', displayName: 'New User' },
      pubKeyCredParams: [],
      timeout: 300000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    mockSignCookiePayload.mockReturnValue('signed-signup-challenge');

    const { POST: regOptionsHandler } = await import('../passkey/register-options/route');
    const regOptionsRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/register-options',
      { email: 'new@example.com', name: 'New User' },
    );
    const regOptionsResponse = await regOptionsHandler(regOptionsRequest);
    const regOptionsData = await regOptionsResponse.json();

    expect(regOptionsResponse.status).toBe(200);
    expect(regOptionsData.options.challenge).toBe('signup-challenge-b64');

    // Challenge cookie was set
    const challengeCookie = regOptionsResponse.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('signed-signup-challenge');

    // --- Step 2: Verify registration and create account ---
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'signup-challenge-b64',
      userId: 'temp-user-id',
      email: 'new@example.com',
      name: 'New User',
      expiresAt: Date.now() + 300000,
    });
    mockDb.limit.mockResolvedValue([]); // Still no existing user (race check)
    mockDb.returning.mockResolvedValue([
      { id: 'new-user-id', email: 'new@example.com', name: 'New User', password: null },
    ]);
    mockVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'new-credential-id',
          publicKey: new Uint8Array([1, 2, 3, 4]),
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
      id: 'passkey-db-id',
      userId: 'new-user-id',
      credentialId: 'new-credential-id',
      deviceName: null,
      createdAt: new Date(),
    });
    mockInitiateMFASetup.mockResolvedValue({
      success: true,
      secret: 'TOTP_SECRET_BASE32',
      uri: 'otpauth://totp/RevealUI:new@example.com',
      backupCodes: ['backup-1', 'backup-2', 'backup-3'],
    });
    mockCreateSession.mockResolvedValue({
      token: 'signup-session-token',
      session: { id: 'signup-session-id' } as never,
    });

    const { POST: regVerifyHandler } = await import('../passkey/register-verify/route');
    const regVerifyRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/register-verify',
      { attestationResponse: { id: 'cred-id', response: {} } },
      { cookies: { 'passkey-challenge': challengeCookie!.value } },
    );
    const regVerifyResponse = await regVerifyHandler(regVerifyRequest);
    const regVerifyData = await regVerifyResponse.json();

    expect(regVerifyResponse.status).toBe(200);
    expect(regVerifyData.success).toBe(true);
    expect(regVerifyData.user.email).toBe('new@example.com');
    expect(regVerifyData.user.name).toBe('New User');
    expect(regVerifyData.backupCodes).toEqual(['backup-1', 'backup-2', 'backup-3']);

    // Session cookie was set
    const sessionCookie = regVerifyResponse.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('signup-session-token');

    // Challenge cookie was cleared
    const clearedChallengeCookie = regVerifyResponse.cookies.get('passkey-challenge');
    expect(clearedChallengeCookie?.value).toBe('');

    // Verify: user created, passkey stored, backup codes returned
    expect(mockStorePasskey).toHaveBeenCalledWith(
      'new-user-id',
      expect.objectContaining({ id: 'new-credential-id' }),
      undefined,
    );
    expect(mockInitiateMFASetup).toHaveBeenCalledWith('new-user-id', 'new@example.com');
    expect(mockCreateSession).toHaveBeenCalledWith('new-user-id', expect.any(Object));
  });
});

// ============================================================================
// 4. Passkey sign-in flow
// ============================================================================

describe('Flow 4: Passkey sign-in', () => {
  it('should sign in with passkey and skip TOTP prompt', async () => {
    // --- Step 1: Request authentication options ---
    mockGenerateAuthenticationChallenge.mockResolvedValue({
      challenge: 'auth-challenge-b64',
      rpId: 'localhost',
      timeout: 300000,
      userVerification: 'preferred',
    });
    mockSignCookiePayload.mockReturnValue('signed-auth-challenge');

    const { POST: authOptionsHandler } = await import('../passkey/authenticate-options/route');
    const authOptionsRequest = new NextRequest(
      'http://localhost:4000/api/auth/passkey/authenticate-options',
      { method: 'POST', headers: { 'content-type': 'application/json' } },
    );
    const authOptionsResponse = await authOptionsHandler(authOptionsRequest);
    const authOptionsData = await authOptionsResponse.json();

    expect(authOptionsResponse.status).toBe(200);
    expect(authOptionsData.options.challenge).toBe('auth-challenge-b64');

    const challengeCookie = authOptionsResponse.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('signed-auth-challenge');

    // --- Step 2: Verify authentication ---
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'auth-challenge-b64',
      expiresAt: Date.now() + 300000,
    });

    // Mock: look up passkey by credential ID
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'passkey-db-id',
        userId: 'user-pk-123',
        credentialId: 'stored-cred-id',
        publicKey: Buffer.from([10, 20, 30]),
        counter: 5,
        transports: ['internal'],
      },
    ]);
    // Mock: look up user
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 'user-pk-123',
        email: 'passkey-user@example.com',
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
      token: 'passkey-signin-token',
      session: { id: 'passkey-session-id' } as never,
    });

    const { POST: authVerifyHandler } = await import('../passkey/authenticate-verify/route');
    const authVerifyRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/authenticate-verify',
      {
        authenticationResponse: {
          id: 'stored-cred-id',
          rawId: 'raw-id',
          response: { authenticatorData: 'data', clientDataJSON: 'json', signature: 'sig' },
          type: 'public-key',
        },
      },
      { cookies: { 'passkey-challenge': challengeCookie!.value } },
    );
    const authVerifyResponse = await authVerifyHandler(authVerifyRequest);
    const authVerifyData = await authVerifyResponse.json();

    expect(authVerifyResponse.status).toBe(200);
    expect(authVerifyData.success).toBe(true);
    expect(authVerifyData.user.email).toBe('passkey-user@example.com');

    // Session cookie was set  -  NO TOTP prompt
    const sessionCookie = authVerifyResponse.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('passkey-signin-token');

    // No mfa-pending cookie was set (passkeys skip MFA)
    const mfaPending = authVerifyResponse.cookies.get('mfa-pending');
    expect(mfaPending).toBeUndefined();

    // Challenge cookie was cleared
    const clearedChallenge = authVerifyResponse.cookies.get('passkey-challenge');
    expect(clearedChallenge?.value).toBe('');

    // Verify the chain: session created directly without MFA
    expect(mockVerifyAuthentication).toHaveBeenCalled();
    expect(mockRotateSession).toHaveBeenCalledWith('user-pk-123', expect.any(Object));
    // verifyMFACode should NOT have been called
    expect(mockVerifyMFACode).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 5. Passkey management flow
// ============================================================================

describe('Flow 5: Passkey management', () => {
  it('should list, add, rename, and delete passkeys', async () => {
    // --- Step 1: List passkeys ---
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
    ]);

    const { GET: listHandler } = await import('../passkey/list/route');
    const listRequest = createGetRequest('http://localhost:4000/api/auth/passkey/list', {
      'revealui-session': 'test-token',
    });
    const listResponse = await listHandler(listRequest);
    const listData = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listData.passkeys).toHaveLength(1);
    expect(listData.passkeys[0].deviceName).toBe('MacBook Pro');

    // --- Step 2: Register a new passkey (authenticated flow) ---
    mockGetSession.mockResolvedValue(mockSession);
    mockListPasskeys.mockResolvedValue([
      {
        id: 'pk-1',
        credentialId: 'cred-1',
        deviceName: 'MacBook Pro',
        backedUp: false,
        createdAt: new Date(),
        lastUsedAt: null,
      },
    ]);
    mockGenerateRegistrationChallenge.mockResolvedValue({
      challenge: 'add-passkey-challenge',
      rp: { name: 'RevealUI', id: 'localhost' },
      user: { id: mockSession.user.id, name: 'test@example.com', displayName: 'test@example.com' },
      pubKeyCredParams: [],
      timeout: 300000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    mockSignCookiePayload.mockReturnValue('signed-add-challenge');

    const { POST: regOptionsHandler } = await import('../passkey/register-options/route');
    const regOptionsRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/register-options',
      {},
      { cookies: { 'revealui-session': 'test-token' } },
    );
    const regOptionsResponse = await regOptionsHandler(regOptionsRequest);
    const regOptionsData = await regOptionsResponse.json();

    expect(regOptionsResponse.status).toBe(200);
    expect(regOptionsData.options.challenge).toBe('add-passkey-challenge');

    const challengeCookie = regOptionsResponse.cookies.get('passkey-challenge');
    expect(challengeCookie?.value).toBe('signed-add-challenge');

    // --- Step 3: Verify registration (add passkey) ---
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'add-passkey-challenge',
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
          id: 'new-cred-id-2',
          publicKey: new Uint8Array([5, 6, 7]),
          counter: 0,
          transports: ['usb'],
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
      id: 'pk-2',
      userId: mockSession.user.id,
      credentialId: 'new-cred-id-2',
      deviceName: 'YubiKey 5',
      createdAt: new Date(),
    });

    const { POST: regVerifyHandler } = await import('../passkey/register-verify/route');
    const regVerifyRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/register-verify',
      { attestationResponse: { id: 'cred-id', response: {} }, deviceName: 'YubiKey 5' },
      {
        cookies: {
          'revealui-session': 'test-token',
          'passkey-challenge': challengeCookie!.value,
        },
      },
    );
    const regVerifyResponse = await regVerifyHandler(regVerifyRequest);
    const regVerifyData = await regVerifyResponse.json();

    expect(regVerifyResponse.status).toBe(200);
    expect(regVerifyData.success).toBe(true);
    expect(mockStorePasskey).toHaveBeenCalledWith(
      mockSession.user.id,
      expect.objectContaining({ id: 'new-cred-id-2' }),
      'YubiKey 5',
    );

    // --- Step 4: Rename the new passkey ---
    mockGetSession.mockResolvedValue(mockSession);
    mockRenamePasskey.mockResolvedValue(undefined);

    const { PATCH: patchHandler } = await import('../passkey/[id]/route');
    const patchRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/pk-2',
      { deviceName: 'YubiKey 5 NFC' },
      { method: 'PATCH', cookies: { 'revealui-session': 'test-token' } },
    );
    const patchResponse = await patchHandler(patchRequest, {
      params: Promise.resolve({ id: 'pk-2' }),
    });
    const patchData = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patchData.success).toBe(true);
    expect(mockRenamePasskey).toHaveBeenCalledWith(mockSession.user.id, 'pk-2', 'YubiKey 5 NFC');

    // --- Step 5: Delete the old passkey ---
    mockGetSession.mockResolvedValue(mockSession);
    mockDeletePasskey.mockResolvedValue(undefined);

    const { DELETE: deleteHandler } = await import('../passkey/[id]/route');
    const deleteRequest = new NextRequest('http://localhost:4000/api/auth/passkey/pk-1', {
      method: 'DELETE',
      headers: { cookie: 'revealui-session=test-token' },
    });
    const deleteResponse = await deleteHandler(deleteRequest, {
      params: Promise.resolve({ id: 'pk-1' }),
    });
    const deleteData = await deleteResponse.json();

    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);
    expect(mockDeletePasskey).toHaveBeenCalledWith(mockSession.user.id, 'pk-1');
  });
});

// ============================================================================
// 6. Magic link recovery flow
// ============================================================================

describe('Flow 6: Magic link recovery', () => {
  it('should request magic link, verify it, then add passkey in recovery session', async () => {
    // --- Step 1: Request magic link ---
    const mockLimit = mockDb.limit as MockFn;
    mockLimit.mockResolvedValue([{ id: 'user-recovery-789' }]);
    mockCreateMagicLink.mockResolvedValue({
      token: 'magic-token-abc123',
      expiresAt: new Date(Date.now() + 900_000),
    });

    const { POST: requestHandler } = await import('../recovery/request/route');
    const requestRequest = createJsonRequest('http://localhost:4000/api/auth/recovery/request', {
      email: 'recovery-user@example.com',
    });
    const requestResponse = await requestHandler(requestRequest);
    const requestData = await requestResponse.json();

    expect(requestResponse.status).toBe(200);
    expect(requestData.success).toBe(true);
    expect(mockCreateMagicLink).toHaveBeenCalledWith('user-recovery-789');

    // --- Step 2: Verify magic link token ---
    mockVerifyMagicLink.mockResolvedValue({ userId: 'user-recovery-789' });
    mockCreateSession.mockResolvedValue({
      token: 'recovery-session-token',
      session: { id: 'recovery-session-id' } as never,
    });

    const { POST: verifyHandler } = await import('../recovery/verify/route');
    const verifyRequest = createJsonRequest('http://localhost:4000/api/auth/recovery/verify', {
      token: 'magic-token-abc123',
    });
    const verifyResponse = await verifyHandler(verifyRequest);
    const verifyData = await verifyResponse.json();

    expect(verifyResponse.status).toBe(200);
    expect(verifyData.success).toBe(true);

    // Session cookie was set with recovery session
    const sessionCookie = verifyResponse.cookies.get('revealui-session');
    expect(sessionCookie?.value).toBe('recovery-session-token');

    // Verify: recovery session has 30-min expiry and metadata
    expect(mockCreateSession).toHaveBeenCalledWith(
      'user-recovery-789',
      expect.objectContaining({
        expiresAt: expect.any(Date),
        metadata: { recovery: true },
      }),
    );

    // --- Step 3: Add a passkey in the recovery session ---
    const recoverySession = {
      ...mockSession,
      session: {
        ...mockSession.session,
        userId: 'user-recovery-789',
        metadata: { recovery: true },
      },
      user: {
        ...mockSession.user,
        id: 'user-recovery-789',
        email: 'recovery-user@example.com',
      },
    };
    mockGetSession.mockResolvedValue(recoverySession);
    mockListPasskeys.mockResolvedValue([]);
    mockGenerateRegistrationChallenge.mockResolvedValue({
      challenge: 'recovery-reg-challenge',
      rp: { name: 'RevealUI', id: 'localhost' },
      user: {
        id: 'user-recovery-789',
        name: 'recovery-user@example.com',
        displayName: 'recovery-user@example.com',
      },
      pubKeyCredParams: [],
      timeout: 300000,
      attestation: 'none',
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
    mockSignCookiePayload.mockReturnValue('signed-recovery-challenge');

    const { POST: regOptionsHandler } = await import('../passkey/register-options/route');
    const regOptionsRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/register-options',
      {},
      { cookies: { 'revealui-session': 'recovery-session-token' } },
    );
    const regOptionsResponse = await regOptionsHandler(regOptionsRequest);
    const regOptionsData = await regOptionsResponse.json();

    expect(regOptionsResponse.status).toBe(200);
    expect(regOptionsData.options.challenge).toBe('recovery-reg-challenge');

    const recoveryChalleneCookie = regOptionsResponse.cookies.get('passkey-challenge');
    expect(recoveryChalleneCookie?.value).toBe('signed-recovery-challenge');

    // --- Step 4: Verify registration to add passkey ---
    mockVerifyCookiePayload.mockReturnValue({
      challenge: 'recovery-reg-challenge',
      userId: 'user-recovery-789',
      expiresAt: Date.now() + 300000,
    });
    mockGetSession.mockResolvedValue(recoverySession);
    mockVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: 'none',
        aaguid: '00000000-0000-0000-0000-000000000000',
        credential: {
          id: 'recovery-cred-id',
          publicKey: new Uint8Array([9, 8, 7]),
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
      id: 'recovery-passkey-id',
      userId: 'user-recovery-789',
      credentialId: 'recovery-cred-id',
      deviceName: 'New Device',
      createdAt: new Date(),
    });

    const { POST: regVerifyHandler } = await import('../passkey/register-verify/route');
    const regVerifyRequest = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/register-verify',
      { attestationResponse: { id: 'cred-id', response: {} }, deviceName: 'New Device' },
      {
        cookies: {
          'revealui-session': 'recovery-session-token',
          'passkey-challenge': recoveryChalleneCookie!.value,
        },
      },
    );
    const regVerifyResponse = await regVerifyHandler(regVerifyRequest);
    const regVerifyData = await regVerifyResponse.json();

    expect(regVerifyResponse.status).toBe(200);
    expect(regVerifyData.success).toBe(true);

    // Verify passkey was stored for the recovery user
    expect(mockStorePasskey).toHaveBeenCalledWith(
      'user-recovery-789',
      expect.objectContaining({ id: 'recovery-cred-id' }),
      'New Device',
    );
  });
});

// ============================================================================
// 7. MFA disable with passkey re-auth
// ============================================================================

describe('Flow 7: MFA disable with passkey proof', () => {
  it('should disable MFA when authenticated with passkey proof', async () => {
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

    const { POST: disableHandler } = await import('../mfa/disable/route');
    const disableRequest = createJsonRequest(
      'http://localhost:4000/api/auth/mfa/disable',
      { method: 'passkey', authenticationResponse: { id: 'cred-id', response: {} } },
      { cookies: { 'revealui-session': 'test-token', 'passkey-challenge': 'signed-challenge' } },
    );
    const disableResponse = await disableHandler(disableRequest);
    const disableData = await disableResponse.json();

    expect(disableResponse.status).toBe(200);
    expect(disableData.success).toBe(true);

    // Verify disableMFA was called with passkey proof (verified = true)
    expect(mockDisableMFA).toHaveBeenCalledWith(mockSession.user.id, {
      method: 'passkey',
      verified: true,
    });
  });
});

// ============================================================================
// 8. Edge cases
// ============================================================================

describe('Edge cases', () => {
  it('should reject MFA verify with expired mfa-pending cookie', async () => {
    // Cookie present but verifyCookiePayload returns null (expired)
    mockVerifyCookiePayload.mockReturnValue(null);

    const { POST: mfaVerifyHandler } = await import('../mfa/verify/route');
    const request = createJsonRequest(
      'http://localhost:4000/api/auth/mfa/verify',
      {
        code: '123456',
      },
      { cookies: { 'mfa-pending': 'expired-signed-value' } },
    );
    const response = await mfaVerifyHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should reject passkey verify with expired challenge cookie', async () => {
    // Cookie present but verifyCookiePayload returns null (expired)
    mockVerifyCookiePayload.mockReturnValue(null);

    const { POST: authVerifyHandler } = await import('../passkey/authenticate-verify/route');
    const request = createJsonRequest(
      'http://localhost:4000/api/auth/passkey/authenticate-verify',
      {
        authenticationResponse: {
          id: 'cred-id',
          rawId: 'raw-id',
          response: {},
          type: 'public-key',
        },
      },
      { cookies: { 'passkey-challenge': 'expired-signed-value' } },
    );
    const response = await authVerifyHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should reject MFA verify when mfa-pending cookie is missing entirely', async () => {
    const { POST: mfaVerifyHandler } = await import('../mfa/verify/route');
    const request = new NextRequest('http://localhost:4000/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    });
    const response = await mfaVerifyHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should reject passkey authenticate-verify when challenge cookie is missing', async () => {
    const { POST: authVerifyHandler } = await import('../passkey/authenticate-verify/route');
    const request = new NextRequest('http://localhost:4000/api/auth/passkey/authenticate-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        authenticationResponse: { id: 'cred-id', response: {} },
      }),
    });
    const response = await authVerifyHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  it('should block deleting the last passkey (last sign-in method)', async () => {
    mockGetSession.mockResolvedValue(mockSession);
    mockDeletePasskey.mockRejectedValue(new Error('Cannot delete last sign-in method'));

    const { DELETE: deleteHandler } = await import('../passkey/[id]/route');
    const request = new NextRequest('http://localhost:4000/api/auth/passkey/pk-only', {
      method: 'DELETE',
      headers: { cookie: 'revealui-session=test-token' },
    });
    const response = await deleteHandler(request, {
      params: Promise.resolve({ id: 'pk-only' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('PASSKEY_DELETE_BLOCKED');
  });
});
