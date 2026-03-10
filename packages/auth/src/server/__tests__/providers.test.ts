import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as github from '../providers/github.js'
import * as google from '../providers/google.js'
import * as vercel from '../providers/vercel.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number): Response {
  return new Response('error', { status })
}

function networkError(): never {
  throw new TypeError('fetch failed')
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)

  // Provide env vars used by exchangeCode
  process.env.GITHUB_CLIENT_ID = 'gh-client-id'
  process.env.GITHUB_CLIENT_SECRET = 'gh-client-secret'
  process.env.GOOGLE_CLIENT_ID = 'google-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
  process.env.VERCEL_CLIENT_ID = 'vercel-client-id'
  process.env.VERCEL_CLIENT_SECRET = 'vercel-client-secret'
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ===========================================================================
// GitHub
// ===========================================================================

describe('GitHub provider', () => {
  // -----------------------------------------------------------------------
  // buildAuthUrl
  // -----------------------------------------------------------------------

  describe('buildAuthUrl', () => {
    it('constructs a valid authorization URL', () => {
      const url = new URL(
        github.buildAuthUrl('my-client', 'https://example.com/callback', 'rand-state'),
      )

      expect(url.origin).toBe('https://github.com')
      expect(url.pathname).toBe('/login/oauth/authorize')
      expect(url.searchParams.get('client_id')).toBe('my-client')
      expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback')
      expect(url.searchParams.get('state')).toBe('rand-state')
      expect(url.searchParams.get('scope')).toBe('read:user user:email')
    })
  })

  // -----------------------------------------------------------------------
  // exchangeCode
  // -----------------------------------------------------------------------

  describe('exchangeCode', () => {
    it('returns access token on success', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ access_token: 'gho_abc123' }))

      const token = await github.exchangeCode('auth-code', 'https://example.com/callback')

      expect(token).toBe('gho_abc123')
      expect(fetchSpy).toHaveBeenCalledOnce()

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://github.com/login/oauth/access_token')
      expect(init?.method).toBe('POST')

      const body = new URLSearchParams(init?.body as string)
      expect(body.get('code')).toBe('auth-code')
      expect(body.get('client_id')).toBe('gh-client-id')
      expect(body.get('client_secret')).toBe('gh-client-secret')
      expect(body.get('redirect_uri')).toBe('https://example.com/callback')
    })

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(500))

      await expect(github.exchangeCode('code', 'https://example.com/callback')).rejects.toThrow(
        'GitHub token exchange failed: 500',
      )
    })

    it('throws when response contains error field', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'bad_verification_code' }))

      await expect(github.exchangeCode('bad-code', 'https://example.com/callback')).rejects.toThrow(
        'GitHub token exchange error: bad_verification_code',
      )
    })

    it('throws when access_token is missing', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}))

      await expect(github.exchangeCode('code', 'https://example.com/callback')).rejects.toThrow(
        'GitHub token exchange returned no access_token',
      )
    })

    it('throws on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'))

      await expect(github.exchangeCode('code', 'https://example.com/callback')).rejects.toThrow(
        'fetch failed',
      )
    })

    it('uses empty strings when env vars are missing', async () => {
      delete process.env.GITHUB_CLIENT_ID
      delete process.env.GITHUB_CLIENT_SECRET

      fetchSpy.mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))

      await github.exchangeCode('code', 'https://example.com/callback')

      const body = new URLSearchParams(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.get('client_id')).toBe('')
      expect(body.get('client_secret')).toBe('')
    })
  })

  // -----------------------------------------------------------------------
  // fetchUser
  // -----------------------------------------------------------------------

  describe('fetchUser', () => {
    it('returns mapped user with public email', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          id: 42,
          login: 'octocat',
          name: 'The Octocat',
          email: 'octocat@github.com',
          avatar_url: 'https://avatars.githubusercontent.com/u/42',
        }),
      )

      const user = await github.fetchUser('token-123')

      expect(user).toEqual({
        id: '42',
        email: 'octocat@github.com',
        name: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/42',
      })

      // Verify auth header
      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer token-123')
    })

    it('falls back to login when name is null', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 1, login: 'ghost', name: null, email: 'a@b.com' }),
      )

      const user = await github.fetchUser('tok')
      expect(user.name).toBe('ghost')
    })

    it('fetches email from /user/emails when public email is null', async () => {
      // First call: /user (no email)
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 99, login: 'private-user', name: 'Private', email: null }),
      )
      // Second call: /user/emails
      fetchSpy.mockResolvedValueOnce(
        jsonResponse([
          { email: 'noreply@github.com', primary: false, verified: true },
          { email: 'real@example.com', primary: true, verified: true },
        ]),
      )

      const user = await github.fetchUser('tok')

      expect(user.email).toBe('real@example.com')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
      expect(fetchSpy.mock.calls[1][0]).toBe('https://api.github.com/user/emails')
    })

    it('returns null email when /user/emails fails', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, login: 'x', name: 'X', email: null }))
      fetchSpy.mockResolvedValueOnce(errorResponse(403))

      const user = await github.fetchUser('tok')
      expect(user.email).toBeNull()
    })

    it('returns null email when no primary verified email exists', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ id: 1, login: 'x', name: 'X', email: null }))
      fetchSpy.mockResolvedValueOnce(
        jsonResponse([{ email: 'unverified@example.com', primary: true, verified: false }]),
      )

      const user = await github.fetchUser('tok')
      expect(user.email).toBeNull()
    })

    it('throws on non-OK /user response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(401))

      await expect(github.fetchUser('bad-token')).rejects.toThrow('GitHub user fetch failed: 401')
    })

    it('returns null avatarUrl when avatar_url is undefined', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({ id: 1, login: 'x', name: 'X', email: 'a@b.com' }),
      )

      const user = await github.fetchUser('tok')
      expect(user.avatarUrl).toBeNull()
    })

    it('throws on network failure', async () => {
      fetchSpy.mockImplementationOnce(networkError)

      await expect(github.fetchUser('tok')).rejects.toThrow('fetch failed')
    })
  })
})

// ===========================================================================
// Google
// ===========================================================================

describe('Google provider', () => {
  // -----------------------------------------------------------------------
  // buildAuthUrl
  // -----------------------------------------------------------------------

  describe('buildAuthUrl', () => {
    it('constructs a valid authorization URL', () => {
      const url = new URL(
        google.buildAuthUrl('goog-client', 'https://app.test/callback', 'state-xyz'),
      )

      expect(url.origin).toBe('https://accounts.google.com')
      expect(url.pathname).toBe('/o/oauth2/v2/auth')
      expect(url.searchParams.get('client_id')).toBe('goog-client')
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/callback')
      expect(url.searchParams.get('state')).toBe('state-xyz')
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('scope')).toBe('openid email profile')
      expect(url.searchParams.get('access_type')).toBe('online')
    })
  })

  // -----------------------------------------------------------------------
  // exchangeCode
  // -----------------------------------------------------------------------

  describe('exchangeCode', () => {
    it('returns access token on success', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ access_token: 'ya29.token' }))

      const token = await google.exchangeCode('goog-code', 'https://app.test/callback')

      expect(token).toBe('ya29.token')

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://oauth2.googleapis.com/token')
      expect(init?.method).toBe('POST')

      const body = new URLSearchParams(init?.body as string)
      expect(body.get('code')).toBe('goog-code')
      expect(body.get('client_id')).toBe('google-client-id')
      expect(body.get('client_secret')).toBe('google-client-secret')
      expect(body.get('grant_type')).toBe('authorization_code')
    })

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(400))

      await expect(google.exchangeCode('code', 'https://app.test/callback')).rejects.toThrow(
        'Google token exchange failed: 400',
      )
    })

    it('throws when access_token is missing', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ token_type: 'Bearer' }))

      await expect(google.exchangeCode('code', 'https://app.test/callback')).rejects.toThrow(
        'Google token exchange returned no access_token',
      )
    })

    it('throws on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'))

      await expect(google.exchangeCode('code', 'https://app.test/callback')).rejects.toThrow(
        'fetch failed',
      )
    })

    it('uses empty strings when env vars are missing', async () => {
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_CLIENT_SECRET

      fetchSpy.mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))

      await google.exchangeCode('code', 'https://app.test/callback')

      const body = new URLSearchParams(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.get('client_id')).toBe('')
      expect(body.get('client_secret')).toBe('')
    })
  })

  // -----------------------------------------------------------------------
  // fetchUser
  // -----------------------------------------------------------------------

  describe('fetchUser', () => {
    it('returns mapped user data', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          sub: '1234567890',
          email: 'user@gmail.com',
          name: 'Test User',
          picture: 'https://lh3.googleusercontent.com/photo.jpg',
        }),
      )

      const user = await google.fetchUser('ya29.token')

      expect(user).toEqual({
        id: '1234567890',
        email: 'user@gmail.com',
        name: 'Test User',
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      })

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo')
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer ya29.token')
    })

    it('defaults name to "Google User" when missing', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ sub: '1' }))

      const user = await google.fetchUser('tok')
      expect(user.name).toBe('Google User')
    })

    it('returns null for missing email and picture', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ sub: '1' }))

      const user = await google.fetchUser('tok')
      expect(user.email).toBeNull()
      expect(user.avatarUrl).toBeNull()
    })

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(403))

      await expect(google.fetchUser('tok')).rejects.toThrow('Google userinfo fetch failed: 403')
    })

    it('throws on network failure', async () => {
      fetchSpy.mockImplementationOnce(networkError)

      await expect(google.fetchUser('tok')).rejects.toThrow('fetch failed')
    })
  })
})

// ===========================================================================
// Vercel
// ===========================================================================

describe('Vercel provider', () => {
  // -----------------------------------------------------------------------
  // buildAuthUrl
  // -----------------------------------------------------------------------

  describe('buildAuthUrl', () => {
    it('constructs a valid authorization URL', () => {
      const url = new URL(vercel.buildAuthUrl('v-client', 'https://app.test/callback', 'v-state'))

      expect(url.origin).toBe('https://vercel.com')
      expect(url.pathname).toBe('/oauth/authorize')
      expect(url.searchParams.get('client_id')).toBe('v-client')
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/callback')
      expect(url.searchParams.get('state')).toBe('v-state')
    })

    it('does not include a scope parameter', () => {
      const url = new URL(vercel.buildAuthUrl('c', 'https://x.com/cb', 's'))
      expect(url.searchParams.has('scope')).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // exchangeCode
  // -----------------------------------------------------------------------

  describe('exchangeCode', () => {
    it('returns access token on success', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ access_token: 'vercel_tok_abc' }))

      const token = await vercel.exchangeCode('v-code', 'https://app.test/callback')

      expect(token).toBe('vercel_tok_abc')

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://api.vercel.com/v2/oauth/access_token')
      expect(init?.method).toBe('POST')

      const body = new URLSearchParams(init?.body as string)
      expect(body.get('code')).toBe('v-code')
      expect(body.get('client_id')).toBe('vercel-client-id')
      expect(body.get('client_secret')).toBe('vercel-client-secret')
    })

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(401))

      await expect(vercel.exchangeCode('code', 'https://app.test/callback')).rejects.toThrow(
        'Vercel token exchange failed: 401',
      )
    })

    it('throws on network failure', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'))

      await expect(vercel.exchangeCode('code', 'https://app.test/callback')).rejects.toThrow(
        'fetch failed',
      )
    })

    it('uses empty strings when env vars are missing', async () => {
      delete process.env.VERCEL_CLIENT_ID
      delete process.env.VERCEL_CLIENT_SECRET

      fetchSpy.mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))

      await vercel.exchangeCode('code', 'https://app.test/callback')

      const body = new URLSearchParams(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.get('client_id')).toBe('')
      expect(body.get('client_secret')).toBe('')
    })
  })

  // -----------------------------------------------------------------------
  // fetchUser
  // -----------------------------------------------------------------------

  describe('fetchUser', () => {
    it('returns mapped user data with avatar URL', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          user: {
            id: 'usr_abc123',
            email: 'dev@vercel.com',
            name: 'Vercel Dev',
            username: 'verceldev',
            avatar: 'abc123hash',
          },
        }),
      )

      const user = await vercel.fetchUser('vercel-token')

      expect(user).toEqual({
        id: 'usr_abc123',
        email: 'dev@vercel.com',
        name: 'Vercel Dev',
        avatarUrl: 'https://avatar.vercel.sh/abc123hash',
      })

      const [url, init] = fetchSpy.mock.calls[0]
      expect(url).toBe('https://api.vercel.com/v2/user')
      const headers = init?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer vercel-token')
    })

    it('falls back to username when name is null', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          user: { id: 'u1', email: 'a@b.com', name: null, username: 'myuser' },
        }),
      )

      const user = await vercel.fetchUser('tok')
      expect(user.name).toBe('myuser')
    })

    it('falls back to "Vercel User" when both name and username are missing', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          user: { id: 'u1', email: 'a@b.com' },
        }),
      )

      const user = await vercel.fetchUser('tok')
      expect(user.name).toBe('Vercel User')
    })

    it('returns null avatarUrl when avatar is not set', async () => {
      fetchSpy.mockResolvedValueOnce(
        jsonResponse({
          user: { id: 'u1', email: 'a@b.com', name: 'X', avatar: null },
        }),
      )

      const user = await vercel.fetchUser('tok')
      expect(user.avatarUrl).toBeNull()
    })

    it('throws on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(errorResponse(403))

      await expect(vercel.fetchUser('tok')).rejects.toThrow('Vercel user fetch failed: 403')
    })

    it('throws on network failure', async () => {
      fetchSpy.mockImplementationOnce(networkError)

      await expect(vercel.fetchUser('tok')).rejects.toThrow('fetch failed')
    })
  })
})
