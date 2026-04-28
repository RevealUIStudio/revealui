import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Mock auth storage with in-memory Map (same pattern as terminal-auth tests)
const mockStore = new Map<string, { value: string; expiresAt: number }>();
vi.mock('@revealui/auth/server', () => ({
  getStorage: () => ({
    get: async (key: string) => {
      const entry = mockStore.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        mockStore.delete(key);
        return null;
      }
      return entry.value;
    },
    set: async (key: string, value: string, ttlSeconds?: number) => {
      mockStore.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Number.POSITIVE_INFINITY,
      });
    },
    del: async (key: string) => {
      mockStore.delete(key);
    },
    exists: async (key: string) => mockStore.has(key),
    incr: async () => 1,
  }),
}));

const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// ---------------------------------------------------------------------------
// DB mock  -  chainable Drizzle-style select/insert/update
// ---------------------------------------------------------------------------
let mockSelectResults: Record<string, unknown>[][] = [];
let insertSpy: ReturnType<typeof vi.fn>;
let updateSetSpy: ReturnType<typeof vi.fn>;

function createMockDb() {
  insertSpy = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });

  updateSetSpy = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });

  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => {
            // Return results in FIFO order  -  tests push in the order queries execute
            return Promise.resolve(mockSelectResults.shift() ?? []);
          }),
        }),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: insertSpy,
    })),
    update: vi.fn().mockImplementation(() => ({
      set: updateSetSpy,
    })),
  };
}

let mockDb = createMockDb();

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

vi.mock('@revealui/db/schema', () => ({
  userDevices: {
    id: 'id',
    userId: 'userId',
    deviceId: 'deviceId',
    deviceName: 'deviceName',
    deviceType: 'deviceType',
    tokenHash: 'tokenHash',
    tokenExpiresAt: 'tokenExpiresAt',
    tokenIssuedAt: 'tokenIssuedAt',
    isActive: 'isActive',
    lastSeen: 'lastSeen',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@revealui/db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
    role: 'role',
  },
}));

import studioAuth, { configureStudioAuth } from '../studio-auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono();
  app.route('/studio-auth', studioAuth);
  return app;
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  Hono generics vary per test
function jsonPost(app: Hono<any>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
function jsonDelete(app: Hono<any>, path: string, headers?: Record<string, string>) {
  return app.request(path, { method: 'DELETE', headers });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
function jsonGet(app: Hono<any>, path: string, headers?: Record<string, string>) {
  return app.request(path, { method: 'GET', headers });
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

function extractOtpFromEmail(): string {
  const emailCall = mockSendEmail.mock.calls[0]![0];
  const codeMatch = emailCall.text.match(/code: (\d{6})/);
  return codeMatch?.[1] ?? '';
}

const TEST_USER = {
  id: 'user-001',
  email: 'studio@example.com',
  name: 'Studio User',
  role: 'admin',
};

const TEST_LINK_BODY = {
  email: 'studio@example.com',
  deviceId: 'device-abc-123',
  deviceName: 'RevealUI Studio (Linux)',
  deviceType: 'desktop' as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('studio-auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
    mockDb = createMockDb();
    mockSelectResults = [];
    configureStudioAuth({ otpTtlMs: 10 * 60 * 1000, otpLength: 6, maxOtpAttempts: 5 });
  });

  afterEach(() => {
    mockStore.clear();
  });

  // =========================================================================
  // POST /studio-auth/link
  // =========================================================================
  describe('POST /studio-auth/link', () => {
    it('sends OTP email and returns success for existing user', async () => {
      mockSelectResults.push([TEST_USER]);
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.message).toContain('studio@example.com');
      expect(mockSendEmail).toHaveBeenCalledOnce();

      // Verify email content mentions device name
      const emailArg = mockSendEmail.mock.calls[0]![0];
      expect(emailArg.to).toBe('studio@example.com');
      expect(emailArg.subject).toContain('Device Verification');
      expect(emailArg.html).toContain('RevealUI Studio (Linux)');
    });

    it('returns generic success when user does not exist (anti-enumeration)', async () => {
      mockSelectResults.push([]); // no user found
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/link', {
        ...TEST_LINK_BODY,
        email: 'nonexistent@example.com',
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      // Should NOT reveal that the email doesn't exist
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/link', {
        ...TEST_LINK_BODY,
        email: 'not-an-email',
      });

      expect(res.status).toBe(400);
    });

    it('requires deviceId', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/link', {
        email: 'studio@example.com',
        deviceName: 'Test',
      });

      expect(res.status).toBe(400);
    });

    it('requires deviceName', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/link', {
        email: 'studio@example.com',
        deviceId: 'device-123',
      });

      expect(res.status).toBe(400);
    });

    it('returns 500 when email sending fails', async () => {
      mockSelectResults.push([TEST_USER]);
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'));
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);

      expect(res.status).toBe(500);
      const body = await parseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Failed to send');
    });

    it('defaults deviceType to desktop', async () => {
      mockSelectResults.push([TEST_USER]);
      const app = createApp();

      const { deviceType: _dt, ...bodyWithoutType } = TEST_LINK_BODY;
      const res = await jsonPost(app, '/studio-auth/link', bodyWithoutType);

      expect(res.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledOnce();
    });

    it('stores OTP in storage keyed by deviceId', async () => {
      mockSelectResults.push([TEST_USER]);
      const app = createApp();

      await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);

      // OTP should be stored under studio-otp:<deviceId>
      const stored = mockStore.get(`studio-otp:${TEST_LINK_BODY.deviceId}`);
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!.value);
      expect(parsed.email).toBe(TEST_LINK_BODY.email);
      expect(parsed.deviceId).toBe(TEST_LINK_BODY.deviceId);
      expect(parsed.code).toMatch(/^\d{6}$/);
    });
  });

  // =========================================================================
  // POST /studio-auth/verify
  // =========================================================================
  describe('POST /studio-auth/verify', () => {
    async function linkAndGetCode(): Promise<string> {
      mockSelectResults.push([TEST_USER]); // for link's user lookup
      const app = createApp();
      await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);
      return extractOtpFromEmail();
    }

    it('returns error when no pending OTP', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/verify', {
        email: 'studio@example.com',
        deviceId: 'device-abc-123',
        code: '123456',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('No pending verification');
    });

    it('returns error for invalid code', async () => {
      const code = await linkAndGetCode();
      expect(code).toHaveLength(6);

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code: '000000',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('Invalid verification code');
    });

    it('returns token on correct code with new device', async () => {
      const code = await linkAndGetCode();

      // DB mocks for verify: user lookup (1st select), device lookup (2nd select)
      mockSelectResults.push([TEST_USER]);
      mockSelectResults.push([]); // no existing device

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.token).toMatch(/^rvui_dev_[a-f0-9]{64}$/);
      expect(body.expiresAt).toBeTruthy();
      expect(body.user).toEqual({
        id: TEST_USER.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        role: TEST_USER.role,
      });

      // Should have called insert for new device
      expect(insertSpy).toHaveBeenCalledOnce();
    });

    it('updates existing device on re-verification', async () => {
      const code = await linkAndGetCode();

      // DB mocks: user found, existing device found
      mockSelectResults.push([TEST_USER]);
      mockSelectResults.push([{ id: 'existing-device-id' }]);

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.token).toMatch(/^rvui_dev_/);

      // Should have called update (not insert) for existing device
      expect(updateSetSpy).toHaveBeenCalledOnce();
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('returns error when email does not match pending OTP', async () => {
      await linkAndGetCode();

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: 'different@example.com',
        deviceId: TEST_LINK_BODY.deviceId,
        code: '123456',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('No pending verification');
    });

    it('returns 429 after max OTP attempts', async () => {
      configureStudioAuth({ maxOtpAttempts: 2 });
      await linkAndGetCode();

      const app = createApp();

      // First wrong attempt
      await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code: '000000',
      });

      // Second wrong attempt
      await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code: '000001',
      });

      // Third attempt should be blocked
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code: '000002',
      });

      expect(res.status).toBe(429);
      const body = await parseBody(res);
      expect(body.error).toContain('Too many attempts');
    });

    it('increments attempt count on wrong code', async () => {
      await linkAndGetCode();

      const app = createApp();
      await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code: '000000',
      });

      // Check that attempts were incremented in storage
      const stored = mockStore.get(`studio-otp:${TEST_LINK_BODY.deviceId}`);
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored!.value);
      expect(parsed.attempts).toBe(1);
    });

    it('consumes OTP after successful verification', async () => {
      const code = await linkAndGetCode();
      mockSelectResults.push([TEST_USER]);
      mockSelectResults.push([]);

      const app = createApp();
      await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      // OTP should be deleted from storage
      const stored = mockStore.get(`studio-otp:${TEST_LINK_BODY.deviceId}`);
      expect(stored).toBeUndefined();
    });

    it('returns 404 when user disappeared between link and verify', async () => {
      const code = await linkAndGetCode();
      mockSelectResults.push([]); // user no longer exists

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      expect(res.status).toBe(404);
      const body = await parseBody(res);
      expect(body.error).toContain('Account not found');
    });

    it('validates code length', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/verify', {
        email: 'studio@example.com',
        deviceId: 'device-abc-123',
        code: '12', // too short
      });

      expect(res.status).toBe(400);
    });

    it('returns error for expired OTP', async () => {
      configureStudioAuth({ otpTtlMs: 1 }); // 1ms TTL
      await linkAndGetCode();

      // Manually expire the OTP in mock storage
      const key = `studio-otp:${TEST_LINK_BODY.deviceId}`;
      const entry = mockStore.get(key);
      if (entry) {
        mockStore.set(key, { ...entry, expiresAt: Date.now() - 1 });
      }

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code: '123456',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('No pending verification');
    });
  });

  // =========================================================================
  // POST /studio-auth/refresh
  // =========================================================================
  describe('POST /studio-auth/refresh', () => {
    const validToken = `rvui_dev_${'a'.repeat(64)}`;

    it('returns 401 without Authorization header', async () => {
      const app = createApp();

      const res = await jsonPost(app, '/studio-auth/refresh', {});

      expect(res.status).toBe(401);
      const body = await parseBody(res);
      expect(body.error).toContain('device token required');
    });

    it('returns 401 with non-device bearer token', async () => {
      const app = createApp();

      const res = await app.request('/studio-auth/refresh', {
        method: 'POST',
        headers: { Authorization: 'Bearer some-session-token' },
      });

      expect(res.status).toBe(401);
    });

    it('returns 401 when token not found in DB', async () => {
      mockSelectResults.push([]); // no device found
      const app = createApp();

      const res = await app.request('/studio-auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      });

      expect(res.status).toBe(401);
      const body = await parseBody(res);
      expect(body.error).toContain('Invalid or expired');
    });

    it('returns 401 when token is expired', async () => {
      mockSelectResults.push([
        {
          id: 'dev-id',
          userId: 'user-001',
          tokenExpiresAt: new Date(Date.now() - 1000), // expired
        },
      ]);
      const app = createApp();

      const res = await app.request('/studio-auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      });

      expect(res.status).toBe(401);
    });

    it('returns new token when current token is valid', async () => {
      mockSelectResults.push([
        {
          id: 'dev-id',
          userId: 'user-001',
          tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30d future
        },
      ]);
      const app = createApp();

      const res = await app.request('/studio-auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.token).toMatch(/^rvui_dev_[a-f0-9]{64}$/);
      expect(body.token).not.toBe(validToken); // must be a new token
      expect(body.expiresAt).toBeTruthy();

      // Should have updated the device record
      expect(updateSetSpy).toHaveBeenCalledOnce();
    });
  });

  // =========================================================================
  // DELETE /studio-auth/revoke
  // =========================================================================
  describe('DELETE /studio-auth/revoke', () => {
    const validToken = `rvui_dev_${'b'.repeat(64)}`;

    it('returns 401 without Authorization header', async () => {
      const app = createApp();

      const res = await jsonDelete(app, '/studio-auth/revoke');

      expect(res.status).toBe(401);
      const body = await parseBody(res);
      expect(body.error).toContain('device token required');
    });

    it('revokes token and returns success', async () => {
      const app = createApp();

      const res = await jsonDelete(app, '/studio-auth/revoke', {
        Authorization: `Bearer ${validToken}`,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.message).toContain('revoked');

      // Should have set tokenHash/tokenExpiresAt to null, isActive to false
      expect(updateSetSpy).toHaveBeenCalledOnce();
      const setArgs = updateSetSpy.mock.calls[0]![0];
      expect(setArgs.tokenHash).toBeNull();
      expect(setArgs.tokenExpiresAt).toBeNull();
      expect(setArgs.tokenIssuedAt).toBeNull();
      expect(setArgs.isActive).toBe(false);
    });
  });

  // =========================================================================
  // GET /studio-auth/status
  // =========================================================================
  describe('GET /studio-auth/status', () => {
    const validToken = `rvui_dev_${'c'.repeat(64)}`;

    it('returns authenticated:false without token', async () => {
      const app = createApp();

      const res = await jsonGet(app, '/studio-auth/status');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.authenticated).toBe(false);
    });

    it('returns authenticated:false with non-device token', async () => {
      const app = createApp();

      const res = await jsonGet(app, '/studio-auth/status', {
        Authorization: 'Bearer some-session-token',
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.authenticated).toBe(false);
    });

    it('returns authenticated:false when device not found', async () => {
      mockSelectResults.push([]); // no device
      const app = createApp();

      const res = await jsonGet(app, '/studio-auth/status', {
        Authorization: `Bearer ${validToken}`,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.authenticated).toBe(false);
    });

    it('returns authenticated:false when token is expired', async () => {
      mockSelectResults.push([
        {
          deviceId: 'dev-123',
          deviceName: 'Studio',
          userId: 'user-001',
          tokenExpiresAt: new Date(Date.now() - 1000),
          isActive: true,
        },
      ]);
      const app = createApp();

      const res = await jsonGet(app, '/studio-auth/status', {
        Authorization: `Bearer ${validToken}`,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.authenticated).toBe(false);
    });

    it('returns user and device info when authenticated', async () => {
      const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // First select: device lookup, second select: user lookup
      // But in status, device is queried first, then user
      mockSelectResults.push([
        {
          deviceId: 'dev-123',
          deviceName: 'RevealUI Studio (Linux)',
          userId: 'user-001',
          tokenExpiresAt: futureExpiry,
          isActive: true,
        },
      ]);
      mockSelectResults.push([TEST_USER]);

      const app = createApp();

      const res = await jsonGet(app, '/studio-auth/status', {
        Authorization: `Bearer ${validToken}`,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.authenticated).toBe(true);
      expect(body.user).toEqual({
        id: TEST_USER.id,
        email: TEST_USER.email,
        name: TEST_USER.name,
        role: TEST_USER.role,
      });
      expect(body.device).toEqual({
        id: 'dev-123',
        name: 'RevealUI Studio (Linux)',
      });
      expect(body.tokenExpiresAt).toBeTruthy();
    });

    it('returns authenticated:false when user not found for device', async () => {
      mockSelectResults.push([
        {
          deviceId: 'dev-123',
          deviceName: 'Studio',
          userId: 'deleted-user',
          tokenExpiresAt: new Date(Date.now() + 86400000),
          isActive: true,
        },
      ]);
      mockSelectResults.push([]); // user deleted

      const app = createApp();

      const res = await jsonGet(app, '/studio-auth/status', {
        Authorization: `Bearer ${validToken}`,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.authenticated).toBe(false);
    });
  });

  // =========================================================================
  // Token format validation
  // =========================================================================
  describe('token format', () => {
    it('generates tokens with rvui_dev_ prefix and 64 hex chars', async () => {
      const code = await (async () => {
        mockSelectResults.push([TEST_USER]);
        const app = createApp();
        await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);
        return extractOtpFromEmail();
      })();

      mockSelectResults.push([TEST_USER]);
      mockSelectResults.push([]);

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      const body = await parseBody(res);
      expect(body.token).toMatch(/^rvui_dev_[a-f0-9]{64}$/);
      expect(body.token).toHaveLength(9 + 64); // "rvui_dev_" + 64 hex chars
    });

    it('stores SHA-256 hash of token, not plaintext', async () => {
      const code = await (async () => {
        mockSelectResults.push([TEST_USER]);
        const app = createApp();
        await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);
        return extractOtpFromEmail();
      })();

      mockSelectResults.push([TEST_USER]);
      mockSelectResults.push([]);

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      const body = await parseBody(res);
      const expectedHash = createHash('sha256').update(body.token).digest('hex');

      // The insert call should have the hash, not the raw token
      const insertArgs = insertSpy.mock.calls[0]![0];
      expect(insertArgs.tokenHash).toBe(expectedHash);
      expect(insertArgs.tokenHash).not.toBe(body.token);
    });
  });

  // =========================================================================
  // Configuration
  // =========================================================================
  describe('configuration', () => {
    it('respects custom OTP length', async () => {
      configureStudioAuth({ otpLength: 8 });
      mockSelectResults.push([TEST_USER]);
      const app = createApp();

      await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);

      const stored = mockStore.get(`studio-otp:${TEST_LINK_BODY.deviceId}`);
      const parsed = JSON.parse(stored!.value);
      expect(parsed.code).toMatch(/^\d{8}$/);
    });

    it('respects custom token lifetime', async () => {
      const customLifetimeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      configureStudioAuth({ tokenLifetimeMs: customLifetimeMs });

      const code = await (async () => {
        mockSelectResults.push([TEST_USER]);
        const app = createApp();
        await jsonPost(app, '/studio-auth/link', TEST_LINK_BODY);
        return extractOtpFromEmail();
      })();

      mockSelectResults.push([TEST_USER]);
      mockSelectResults.push([]);

      const app = createApp();
      const res = await jsonPost(app, '/studio-auth/verify', {
        email: TEST_LINK_BODY.email,
        deviceId: TEST_LINK_BODY.deviceId,
        code,
      });

      const body = await parseBody(res);
      const expiresAt = new Date(body.expiresAt).getTime();
      const expectedExpiry = Date.now() + customLifetimeMs;
      // Allow 5 second tolerance for test execution time
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(5000);
    });
  });
});
