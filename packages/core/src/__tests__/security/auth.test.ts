import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OAuthClient, OAuthProviders, PasswordHasher, TwoFactorAuth } from '../../security/auth.js'

describe('OAuthProviders', () => {
  it('has google, github, microsoft configs', () => {
    expect(OAuthProviders.google.authorizationUrl).toContain('accounts.google.com')
    expect(OAuthProviders.github.authorizationUrl).toContain('github.com')
    expect(OAuthProviders.microsoft.authorizationUrl).toContain('microsoftonline.com')
  })
})

describe('OAuthClient', () => {
  const baseConfig = {
    provider: 'github' as const,
    clientId: 'test-id',
    clientSecret: 'test-secret',
    redirectUri: 'http://localhost:3000/callback',
  }

  describe('getAuthorizationUrl', () => {
    it('builds URL with client_id and redirect_uri', () => {
      const client = new OAuthClient(baseConfig)
      const url = client.getAuthorizationUrl()

      expect(url).toContain('github.com/login/oauth/authorize')
      expect(url).toContain('client_id=test-id')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('response_type=code')
    })

    it('includes state parameter when provided', () => {
      const client = new OAuthClient(baseConfig)
      const url = client.getAuthorizationUrl('abc123')

      expect(url).toContain('state=abc123')
    })

    it('uses provider default scope', () => {
      const client = new OAuthClient(baseConfig)
      const url = client.getAuthorizationUrl()

      expect(url).toContain('scope=user%3Aemail')
    })

    it('uses custom scope when provided', () => {
      const client = new OAuthClient({ ...baseConfig, scope: ['repo', 'read:org'] })
      const url = client.getAuthorizationUrl()

      expect(url).toContain('scope=repo+read%3Aorg')
    })
  })

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('exchanges code successfully', async () => {
      const tokenResponse = {
        access_token: 'gho_test',
        token_type: 'bearer',
        expires_in: 3600,
      }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(tokenResponse), { status: 200 }),
      )

      const client = new OAuthClient(baseConfig)
      const result = await client.exchangeCodeForToken('auth-code-123')

      expect(result.access_token).toBe('gho_test')
      expect(fetch).toHaveBeenCalledOnce()
    })

    it('throws on non-ok response with status detail', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('bad_verification_code', { status: 400 }),
      )

      const client = new OAuthClient(baseConfig)
      await expect(client.exchangeCodeForToken('bad')).rejects.toThrow(
        /Failed to exchange code.*400/,
      )
    })

    it('throws when tokenUrl is missing', async () => {
      const client = new OAuthClient({
        ...baseConfig,
        provider: 'custom',
        tokenUrl: undefined,
      })

      await expect(client.exchangeCodeForToken('code')).rejects.toThrow('tokenUrl is required')
    })
  })

  describe('getUserInfo', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('fetches user info with bearer token', async () => {
      const userInfo = { id: '12345', email: 'user@test.com', name: 'Test' }
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(userInfo), { status: 200 }),
      )

      const client = new OAuthClient(baseConfig)
      const result = await client.getUserInfo('gho_token')

      expect(result.email).toBe('user@test.com')
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
      expect(call[1].headers).toMatchObject({ Authorization: 'Bearer gho_token' })
    })

    it('throws on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 }),
      )

      const client = new OAuthClient(baseConfig)
      await expect(client.getUserInfo('bad')).rejects.toThrow(/Failed to fetch user info.*401/)
    })

    it('throws when userInfoUrl is missing', async () => {
      const client = new OAuthClient({
        ...baseConfig,
        provider: 'custom',
        userInfoUrl: undefined,
      })

      await expect(client.getUserInfo('token')).rejects.toThrow('userInfoUrl is required')
    })
  })
})

describe('PasswordHasher', () => {
  it('hashes and verifies a password', async () => {
    const hash = await PasswordHasher.hash('my-password-123')
    expect(hash).toContain(':')

    const valid = await PasswordHasher.verify('my-password-123', hash)
    expect(valid).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await PasswordHasher.hash('correct-password')
    const valid = await PasswordHasher.verify('wrong-password', hash)
    expect(valid).toBe(false)
  })

  it('returns false for malformed hash (no colon)', async () => {
    const valid = await PasswordHasher.verify('password', 'nocolonhere')
    expect(valid).toBe(false)
  })

  it('produces different hashes for same password (random salt)', async () => {
    const h1 = await PasswordHasher.hash('same-password')
    const h2 = await PasswordHasher.hash('same-password')
    expect(h1).not.toBe(h2)
  })
})

describe('TwoFactorAuth', () => {
  describe('generateSecret', () => {
    it('returns a base32 encoded string', () => {
      const secret = TwoFactorAuth.generateSecret()
      expect(secret).toMatch(/^[A-Z2-7]+$/)
      expect(secret.length).toBeGreaterThan(0)
    })

    it('produces unique secrets', () => {
      const s1 = TwoFactorAuth.generateSecret()
      const s2 = TwoFactorAuth.generateSecret()
      expect(s1).not.toBe(s2)
    })
  })

  describe('generateCode', () => {
    it('returns a 6-digit string', () => {
      const secret = TwoFactorAuth.generateSecret()
      const code = TwoFactorAuth.generateCode(secret)
      expect(code).toMatch(/^\d{6}$/)
    })

    it('returns same code for same timestamp', () => {
      const secret = TwoFactorAuth.generateSecret()
      const ts = 1700000000000
      const c1 = TwoFactorAuth.generateCode(secret, ts)
      const c2 = TwoFactorAuth.generateCode(secret, ts)
      expect(c1).toBe(c2)
    })

    it('returns different codes for different time windows', () => {
      const secret = TwoFactorAuth.generateSecret()
      const c1 = TwoFactorAuth.generateCode(secret, 1700000000000)
      const c2 = TwoFactorAuth.generateCode(secret, 1700000060000) // 2 windows later
      expect(c1).not.toBe(c2)
    })
  })

  describe('verifyCode', () => {
    it('verifies a valid code for current time', () => {
      const secret = TwoFactorAuth.generateSecret()
      const code = TwoFactorAuth.generateCode(secret)
      expect(TwoFactorAuth.verifyCode(secret, code)).toBe(true)
    })

    it('rejects an invalid code', () => {
      const secret = TwoFactorAuth.generateSecret()
      expect(TwoFactorAuth.verifyCode(secret, '000000')).toBe(false)
    })

    it('accepts code from adjacent time window (default window=1)', () => {
      const secret = TwoFactorAuth.generateSecret()
      const now = Date.now()
      // Generate code for previous window
      const code = TwoFactorAuth.generateCode(secret, now - 30000)
      // Verify with current time — should accept within window=1
      expect(TwoFactorAuth.verifyCode(secret, code, 1)).toBe(true)
    })
  })
})
