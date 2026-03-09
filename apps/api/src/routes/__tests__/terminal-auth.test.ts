import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockSendEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('../../lib/email.js', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))

import terminalAuth, { clearOtpStore, configureTerminalAuth } from '../terminal-auth.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: test helper — loose Variables type
function createApp(dbMock?: any) {
  // biome-ignore lint/suspicious/noExplicitAny: test helper
  const app = new Hono<{ Variables: { db: any } }>()
  if (dbMock) {
    app.use('*', async (c, next) => {
      c.set('db', dbMock)
      await next()
    })
  }
  app.route('/terminal-auth', terminalAuth)
  return app
}

// biome-ignore lint/suspicious/noExplicitAny: test helper — Hono generics vary per test
function jsonPost(app: Hono<any>, path: string, body: unknown) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// biome-ignore lint/suspicious/noExplicitAny: test helper
async function parseBody(res: Response): Promise<any> {
  return res.json()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('terminal-auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearOtpStore()
    configureTerminalAuth({ otpTtlMs: 5 * 60 * 1000, otpLength: 6, maxPending: 10_000 })
  })

  afterEach(() => {
    clearOtpStore()
  })

  describe('POST /terminal-auth/link', () => {
    it('sends OTP email and returns success', async () => {
      const app = createApp()

      const res = await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:abc123',
        email: 'user@example.com',
      })

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.success).toBe(true)
      expect(body.message).toContain('user@example.com')
      expect(mockSendEmail).toHaveBeenCalledOnce()
    })

    it('validates email format', async () => {
      const app = createApp()

      const res = await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:abc123',
        email: 'not-an-email',
      })

      expect(res.status).toBe(400)
    })

    it('requires fingerprint', async () => {
      const app = createApp()

      const res = await jsonPost(app, '/terminal-auth/link', {
        email: 'user@example.com',
      })

      expect(res.status).toBe(400)
    })

    it('returns 409 if fingerprint is already linked', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'user-1', email: 'existing@example.com' }]),
            }),
          }),
        }),
      }

      vi.doMock('@revealui/db/schema/users', () => ({
        users: {
          id: 'id',
          email: 'email',
          sshKeyFingerprint: 'sshKeyFingerprint',
        },
      }))

      const app = createApp(mockDb)

      const res = await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:already-linked',
        email: 'new@example.com',
      })

      expect(res.status).toBe(409)
      const body = await parseBody(res)
      expect(body.error).toContain('already linked')
    })

    it('returns 500 if email sending fails', async () => {
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'))

      const app = createApp()

      const res = await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:abc123',
        email: 'user@example.com',
      })

      expect(res.status).toBe(500)
      const body = await parseBody(res)
      expect(body.error).toContain('Failed to send')
    })
  })

  describe('POST /terminal-auth/verify', () => {
    it('returns error when no pending OTP', async () => {
      const app = createApp()

      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'nobody@example.com',
        code: '123456',
      })

      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.error).toContain('No pending verification')
    })

    it('returns error for invalid code', async () => {
      // First create a pending OTP via link
      const app = createApp()
      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:test-key',
        email: 'verify@example.com',
      })

      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'verify@example.com',
        code: '000000',
      })

      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.error).toContain('Invalid verification code')
    })

    it('returns error for expired OTP', async () => {
      // Set very short TTL
      configureTerminalAuth({ otpTtlMs: 1 })

      const app = createApp()
      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:expired-key',
        email: 'expired@example.com',
      })

      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10))

      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'expired@example.com',
        code: '123456',
      })

      // cleanupExpired() runs before lookup, so expired OTP is already deleted
      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.error).toContain('No pending verification')
    })

    it('returns 503 when db is not available', async () => {
      // Create OTP, then extract the code from the email mock
      const app = createApp()
      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:no-db-key',
        email: 'nodb@example.com',
      })

      // Extract OTP from email call
      const emailCall = mockSendEmail.mock.calls[0]![0]
      const codeMatch = emailCall.text.match(/code: (\d{6})/)
      const code = codeMatch?.[1]

      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'nodb@example.com',
        code,
      })

      expect(res.status).toBe(503)
      const body = await parseBody(res)
      expect(body.error).toContain('Database not available')
    })

    it('validates code length', async () => {
      const app = createApp()

      const res = await jsonPost(app, '/terminal-auth/verify', {
        email: 'user@example.com',
        code: '12', // too short
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /terminal-auth/lookup', () => {
    it('returns 400 when fingerprint query param is missing', async () => {
      const app = createApp()

      const res = await app.request('/terminal-auth/lookup')

      expect(res.status).toBe(400)
      const body = await parseBody(res)
      expect(body.error).toContain('fingerprint')
    })

    it('returns 503 when db is not available', async () => {
      const app = createApp()

      const res = await app.request('/terminal-auth/lookup?fingerprint=SHA256:test')

      expect(res.status).toBe(503)
    })

    it('returns 404 when user is not found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }

      vi.doMock('@revealui/db/schema/users', () => ({
        users: {
          id: 'id',
          email: 'email',
          name: 'name',
          role: 'role',
          sshKeyFingerprint: 'sshKeyFingerprint',
        },
      }))

      const app = createApp(mockDb)

      const res = await app.request('/terminal-auth/lookup?fingerprint=SHA256:unknown')

      expect(res.status).toBe(404)
    })

    it('returns user data when fingerprint is found', async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { id: 'user-1', email: 'found@example.com', name: 'Found User', role: 'admin' },
                ]),
            }),
          }),
        }),
      }

      vi.doMock('@revealui/db/schema/users', () => ({
        users: {
          id: 'id',
          email: 'email',
          name: 'name',
          role: 'role',
          sshKeyFingerprint: 'sshKeyFingerprint',
        },
      }))

      const app = createApp(mockDb)

      const res = await app.request('/terminal-auth/lookup?fingerprint=SHA256:known')

      expect(res.status).toBe(200)
      const body = await parseBody(res)
      expect(body.success).toBe(true)
      expect(body.user.email).toBe('found@example.com')
    })
  })

  describe('configureTerminalAuth', () => {
    it('generates OTP with configured length', async () => {
      configureTerminalAuth({ otpLength: 8 })

      const app = createApp()
      await jsonPost(app, '/terminal-auth/link', {
        fingerprint: 'SHA256:len-test',
        email: 'len@example.com',
      })

      const emailCall = mockSendEmail.mock.calls[0]![0]
      const codeMatch = emailCall.text.match(/code: (\d+)/)
      expect(codeMatch?.[1]).toHaveLength(8)
    })
  })
})
