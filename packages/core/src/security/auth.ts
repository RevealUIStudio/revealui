/**
 * Authentication Utilities
 *
 * OAuth support, password hashing, and two-factor authentication.
 * JWT-based auth was removed — session auth is handled by @revealui/auth.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export interface User {
  id: string
  email: string
  username?: string
  roles: string[]
  permissions: string[]
  metadata?: Record<string, unknown>
}

/**
 * OAuth configuration
 */
export interface OAuthConfig {
  provider: 'google' | 'github' | 'microsoft' | 'custom'
  clientId: string
  clientSecret: string
  redirectUri: string
  scope?: string[]
  authorizationUrl?: string
  tokenUrl?: string
  userInfoUrl?: string
}

/**
 * OAuth provider configurations
 */
export const OAuthProviders = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scope: ['openid', 'email', 'profile'],
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scope: ['user:email'],
  },
  microsoft: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scope: ['openid', 'email', 'profile'],
  },
}

/**
 * OAuth client
 */
export class OAuthClient {
  private config: OAuthConfig

  constructor(config: OAuthConfig) {
    // Provider defaults fill in missing fields; user-provided config takes precedence
    this.config = {
      ...OAuthProviders[config.provider as keyof typeof OAuthProviders],
      ...config,
    }
  }

  /**
   * Get authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: (this.config.scope || []).join(' '),
    })

    if (state) {
      params.append('state', state)
    }

    return `${this.config.authorizationUrl}?${params.toString()}`
  }

  /**
   * Exchange code for token
   */
  async exchangeCodeForToken(code: string): Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
  }> {
    const response = await fetch(this.config.tokenUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to exchange code for token')
    }

    return response.json()
  }

  /**
   * Get user info
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string
    email: string
    name?: string
    picture?: string
  }> {
    const response = await fetch(this.config.userInfoUrl!, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user info')
    }

    return response.json()
  }
}

/**
 * Password hashing utilities
 *
 * Uses PBKDF2 with a random salt for secure password hashing.
 * For even stronger hashing, use bcryptjs (available in @revealui/auth).
 */
export class PasswordHasher {
  private static readonly ITERATIONS = 100000
  private static readonly KEY_LENGTH = 64
  private static readonly DIGEST = 'sha512'

  /**
   * Hash password with PBKDF2 and random salt
   */
  static async hash(password: string): Promise<string> {
    const { pbkdf2, randomBytes: rb } = await import('node:crypto')
    const salt = rb(16).toString('hex')

    return new Promise((resolve, reject) => {
      pbkdf2(
        password,
        salt,
        PasswordHasher.ITERATIONS,
        PasswordHasher.KEY_LENGTH,
        PasswordHasher.DIGEST,
        (err, derivedKey) => {
          if (err) reject(err)
          else resolve(`${salt}:${derivedKey.toString('hex')}`)
        },
      )
    })
  }

  /**
   * Verify password against stored hash
   */
  static async verify(password: string, storedHash: string): Promise<boolean> {
    const { pbkdf2, timingSafeEqual } = await import('node:crypto')
    const [salt, hash] = storedHash.split(':')

    if (!(salt && hash)) {
      return false
    }

    return new Promise((resolve, reject) => {
      pbkdf2(
        password,
        salt,
        PasswordHasher.ITERATIONS,
        PasswordHasher.KEY_LENGTH,
        PasswordHasher.DIGEST,
        (err, derivedKey) => {
          if (err) reject(err)
          else {
            const derived = Buffer.from(derivedKey.toString('hex'), 'utf-8')
            const expected = Buffer.from(hash, 'utf-8')
            if (derived.length !== expected.length) {
              resolve(false)
            } else {
              resolve(timingSafeEqual(derived, expected))
            }
          }
        },
      )
    })
  }
}

/**
 * Two-factor authentication
 */
export class TwoFactorAuth {
  /**
   * Generate TOTP secret
   */
  static generateSecret(): string {
    const crypto = globalThis.crypto
    if (!crypto) {
      throw new Error('Crypto API not available')
    }

    const buffer = new Uint8Array(20)
    crypto.getRandomValues(buffer)
    return TwoFactorAuth.base32Encode(buffer)
  }

  /**
   * Generate TOTP code
   */
  static generateCode(secret: string, timestamp?: number): string {
    const time = Math.floor((timestamp || Date.now()) / 30000)
    const hmacDigest = TwoFactorAuth.hmac(secret, time.toString())
    const offset = hmacDigest[hmacDigest.length - 1]! & 0x0f
    const code =
      (((hmacDigest[offset]! & 0x7f) << 24) |
        ((hmacDigest[offset + 1]! & 0xff) << 16) |
        ((hmacDigest[offset + 2]! & 0xff) << 8) |
        (hmacDigest[offset + 3]! & 0xff)) %
      1000000

    return code.toString().padStart(6, '0')
  }

  /**
   * Verify TOTP code
   */
  static verifyCode(secret: string, code: string, window: number = 1): boolean {
    const timestamp = Date.now()

    // Check current and adjacent time windows
    for (let i = -window; i <= window; i++) {
      const testTime = timestamp + i * 30000
      const testCode = TwoFactorAuth.generateCode(secret, testTime)

      if (
        testCode.length === code.length &&
        timingSafeEqual(Buffer.from(testCode), Buffer.from(code))
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Base32 encode
   */
  private static base32Encode(buffer: Uint8Array): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let result = ''
    let bits = 0
    let value = 0

    for (const byte of buffer) {
      if (byte === undefined) continue
      value = (value << 8) | byte
      bits += 8

      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31]
        bits -= 5
      }
    }

    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31]
    }

    return result
  }

  /**
   * HMAC-SHA1 implementation for TOTP
   */
  private static hmac(key: string, message: string): Uint8Array {
    const hmacDigest = createHmac('sha1', key).update(message).digest()
    return new Uint8Array(hmacDigest)
  }
}
