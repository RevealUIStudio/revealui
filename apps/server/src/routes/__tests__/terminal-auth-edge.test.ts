import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies (mirrors terminal-auth.test.ts setup)
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// Static mock for users schema (used by all three endpoints via dynamic import)
vi.mock('@revealui/db/schema/users', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
    role: 'role',
    sshKeyFingerprint: 'sshKeyFingerprint',
    updatedAt: 'updatedAt',
  },
}));

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

import terminalAuth, { clearOtpStore, configureTerminalAuth } from '../terminal-auth.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type TestUser = { id: string };

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  loose Variables type
function createApp(dbMock?: any, user?: TestUser) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { db?: any; user?: TestUser } }>();
  app.use('*', async (c, next) => {
    if (dbMock) c.set('db', dbMock);
    if (user) c.set('user', user);
    await next();
  });
  app.route('/terminal-auth', terminalAuth);
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
async function parseBody(res: Response): Promise<any> {
  return res.json();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('terminal-auth edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.clear();
    clearOtpStore();
    configureTerminalAuth({ otpTtlMs: 5 * 60 * 1000, otpLength: 6 });
  });

  afterEach(() => {
    mockStore.clear();
    clearOtpStore();
  });

  describe('POST /terminal-auth/link  -  OTP overwrite', () => {
    it('second link for same email replaces first OTP; verify stores second fingerprint', async () => {
      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      // First select (link: fingerprint check) → not linked each time.
      // Third select (verify: find user by email) → user found.
      const mockLimit = vi
        .fn()
        .mockResolvedValueOnce([]) // link #1: fingerprint check → not linked
        .mockResolvedValueOnce([]) // link #2: fingerprint check → not linked
        .mockResolvedValueOnce([{ id: 'user-1', role: 'user' }]); // verify: user lookup
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ limit: mockLimit }),
          }),
        }),
        update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
      };

      const app = createApp(mockDb);

      // First link  -  fingerprint:first
      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:first-key',
        email: 'overwrite@example.com',
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      // Second link  -  fingerprint:second (overwrites stored OTP)
      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:second-key',
        email: 'overwrite@example.com',
      });
      expect(mockSendEmail).toHaveBeenCalledTimes(2);

      // Extract code from second email
      const secondEmailCall = mockSendEmail.mock.calls[1]![0];
      const code = secondEmailCall.text.match(/code: (\d{6})/)?.[1];
      expect(code).toBeDefined();

      // Verify using the second code  -  should succeed
      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'overwrite@example.com',
        code,
      });

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);

      // The fingerprint written to the user record must be from the second link
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ sshKeyFingerprint: 'SHA256:second-key' }),
      );
    });
  });

  describe('GET /terminal-auth/lookup  -  full user fields', () => {
    it('returns id, name, and role alongside email', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: 'user-99',
                  email: 'full@example.com',
                  name: 'Full Name',
                  role: 'editor',
                },
              ]),
            }),
          }),
        }),
      };

      const app = createApp(mockDb, { id: 'caller-1' });
      const res = await app.request('/terminal-auth/lookup?fingerprint=SHA256:full');

      expect(res.status).toBe(200);
      const body = await parseBody(res);
      expect(body.success).toBe(true);
      expect(body.user.id).toBe('user-99');
      expect(body.user.email).toBe('full@example.com');
      expect(body.user.name).toBe('Full Name');
      expect(body.user.role).toBe('editor');
    });
  });

  describe('POST /terminal-auth/verify  -  max attempt lockout', () => {
    beforeEach(() => {
      // Reduce limit to 1 for lockout tests  -  1 failed attempt triggers the gate
      configureTerminalAuth({ otpTtlMs: 5 * 60 * 1000, otpLength: 6, maxOtpAttempts: 1 });
    });

    it('returns 429 after maxOtpAttempts failed attempts', async () => {
      // No db  -  link skips fingerprint check, OTP is still sent
      const app = createApp();

      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:lockout-key',
        email: 'lockout@example.com',
      });

      // First bad attempt  -  attempts goes 0 → 1 (< maxOtpAttempts=1 at check time, so 400)
      await jsonPost(app, '/terminal-auth/verify', {
        email: 'lockout@example.com',
        code: '000000', // never valid  -  OTP range is 100000-999999
      });

      // Second attempt  -  attempts=1 >= maxOtpAttempts=1 → 429
      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'lockout@example.com',
        code: '000000',
      });

      expect(res.status).toBe(429);
      const body = await parseBody(res);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Too many verification attempts');
    });

    it('deletes OTP on lockout so the next request returns no-pending-verification', async () => {
      const app = createApp();

      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:consumed-key',
        email: 'consumed@example.com',
      });

      // Burn the first attempt
      await jsonPost(app, '/terminal-auth/verify', {
        email: 'consumed@example.com',
        code: '000000',
      });

      // Trigger lockout (OTP deleted internally)
      await jsonPost(app, '/terminal-auth/verify', {
        email: 'consumed@example.com',
        code: '000000',
      });

      // OTP is gone  -  any further attempt should get 400 "no pending"
      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'consumed@example.com',
        code: '000000',
      });

      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('No pending verification or code has expired');
    });
  });

  describe('POST /terminal-auth/link  -  validation edge cases', () => {
    it('returns 400 when fingerprint is empty string', async () => {
      const app = createApp();
      const res = await jsonPost(app, '/terminal-auth/link', {
        fingerprint: '',
        email: 'edge@example.com',
      });
      expect(res.status).toBe(400);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('returns 400 when body is missing all fields', async () => {
      const app = createApp();
      const res = await jsonPost(app, '/terminal-auth/link', {});
      expect(res.status).toBe(400);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('returns 400 when email is empty string', async () => {
      const app = createApp();
      const res = await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:test-key',
        email: '',
      });
      expect(res.status).toBe(400);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /terminal-auth/verify  -  validation edge cases', () => {
    it('returns 400 when code is too long (7 digits)', async () => {
      const app = createApp();
      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'test@example.com',
        code: '1234567',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is missing from verify body', async () => {
      const app = createApp();
      const res = await jsonPost(app, '/terminal-auth/verify', {
        code: '123456',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when code is missing from verify body', async () => {
      const app = createApp();
      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'test@example.com',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /terminal-auth/lookup  -  edge cases', () => {
    it('returns 400 when fingerprint is empty string query param', async () => {
      const app = createApp(undefined, { id: 'caller-1' });
      const res = await app.request('/terminal-auth/lookup?fingerprint=');
      // Empty string is falsy  -  route should return 400
      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect(body.error).toContain('fingerprint');
    });
  });
});
