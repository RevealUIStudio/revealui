/**
 * Authentication System
 *
 * JWT-based authentication with session management, token refresh, and OAuth support
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { jwtVerify, SignJWT } from 'jose'

export interface User {
  id: string
  email: string
  username?: string
  roles: string[]
  permissions: string[]
  metadata?: Record<string, unknown>
}

export interface AuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenType: 'Bearer' | 'JWT'
}

export interface AuthSession {
  user: User
  token: AuthToken
  createdAt: number
  lastActivity: number
  expiresAt: number
  deviceInfo?: {
    userAgent: string
    ip: string
    device: string
  }
}

export interface JWTPayload {
  sub: string
  email: string
  roles: string[]
  permissions: string[]
  iat: number
  exp: number
  iss?: string
  aud?: string
  [key: string]: unknown
}

export interface AuthConfig {
  jwtSecret: string
  jwtAlgorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256'
  accessTokenExpiry?: number
  refreshTokenExpiry?: number
  issuer?: string
  audience?: string
  sessionTimeout?: number
  refreshThreshold?: number
}

const DEFAULT_CONFIG: Required<Omit<AuthConfig, 'jwtSecret'>> = {
  jwtAlgorithm: 'HS256',
  accessTokenExpiry: 3600, // 1 hour
  refreshTokenExpiry: 604800, // 7 days
  issuer: 'revealui',
  audience: 'revealui-app',
  sessionTimeout: 1800, // 30 minutes
  refreshThreshold: 300, // 5 minutes before expiry
}

/**
 * Authentication system — abstract base class.
 *
 * This class provides JWT token management, session tracking, TOTP, and OAuth
 * infrastructure. The `authenticate()` method intentionally throws and must be
 * overridden by a concrete subclass or replaced with a database-backed
 * implementation (see `@revealui/auth` for the production implementation used
 * by RevealUI's CMS).
 *
 * Do NOT instantiate this class directly and call `authenticate()` — it will
 * always throw. Use `@revealui/auth` for ready-to-use authentication.
 */
export class AuthSystem {
  private static readonly MAX_SESSIONS = 10_000
  private config: Required<AuthConfig>
  private sessions: Map<string, AuthSession> = new Map()
  private refreshTokens: Map<string, string> = new Map() // refreshToken -> userId
  private sessionCleanupInterval?: NodeJS.Timeout

  constructor(config: AuthConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startSessionCleanup()
  }

  /**
   * Authenticate user with credentials
   */
  async authenticate(
    _email: string,
    _password: string,
    _deviceInfo?: AuthSession['deviceInfo'],
  ): Promise<{ user: User; token: AuthToken; session: AuthSession }> {
    // Override this method with your authentication backend.
    // RevealUI's CMS uses @revealui/auth (bcrypt + session storage).
    // Custom integrations should: validate credentials → call createToken() → call createSession().
    throw new Error(
      'AuthSystem.authenticate() must be overridden. See @revealui/auth for the default implementation.',
    )
  }

  /**
   * Create JWT token
   */
  async createToken(
    user: User,
    expiresIn: number = this.config.accessTokenExpiry,
  ): Promise<AuthToken> {
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + expiresIn

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      iat: now,
      exp: expiresAt,
      iss: this.config.issuer,
      aud: this.config.audience,
    }

    const accessToken = await this.encodeJWT(payload)

    // Create refresh token
    const refreshToken = this.generateRefreshToken(user.id)

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt * 1000, // Convert to ms
      tokenType: 'Bearer',
    }
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = await this.decodeJWT(token)

      // Check expiration
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expired')
      }

      // Check issuer
      if (payload.iss !== this.config.issuer) {
        throw new Error('Invalid token issuer')
      }

      // Check audience
      if (payload.aud !== this.config.audience) {
        throw new Error('Invalid token audience')
      }

      return payload
    } catch (error) {
      throw new Error(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthToken> {
    const userId = this.refreshTokens.get(refreshToken)

    if (!userId) {
      throw new Error('Invalid refresh token')
    }

    // Get user session
    const session = Array.from(this.sessions.values()).find((s) => s.user.id === userId)

    if (!session) {
      throw new Error('Session not found')
    }

    // Create new access token
    return await this.createToken(session.user)
  }

  /**
   * Create session
   */
  createSession(user: User, token: AuthToken, deviceInfo?: AuthSession['deviceInfo']): AuthSession {
    const now = Date.now()

    // Evict oldest session if at capacity
    if (this.sessions.size >= AuthSystem.MAX_SESSIONS) {
      let oldestKey: string | undefined
      let oldestTime = Number.POSITIVE_INFINITY
      for (const [key, session] of this.sessions.entries()) {
        if (session.lastActivity < oldestTime) {
          oldestTime = session.lastActivity
          oldestKey = key
        }
      }
      if (oldestKey) {
        this.destroySession(oldestKey)
      }
    }

    const session: AuthSession = {
      user,
      token,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.config.sessionTimeout * 1000,
      deviceInfo,
    }

    this.sessions.set(user.id, session)

    if (token.refreshToken) {
      this.refreshTokens.set(token.refreshToken, user.id)
    }

    return session
  }

  /**
   * Get session
   */
  getSession(userId: string): AuthSession | undefined {
    const session = this.sessions.get(userId)

    if (!session) {
      return undefined
    }

    // Check if session expired
    if (Date.now() > session.expiresAt) {
      this.destroySession(userId)
      return undefined
    }

    return session
  }

  /**
   * Update session activity
   */
  updateSessionActivity(userId: string): void {
    const session = this.sessions.get(userId)

    if (session) {
      session.lastActivity = Date.now()
      session.expiresAt = Date.now() + this.config.sessionTimeout * 1000
    }
  }

  /**
   * Destroy session
   */
  destroySession(userId: string): void {
    const session = this.sessions.get(userId)

    if (session?.token.refreshToken) {
      this.refreshTokens.delete(session.token.refreshToken)
    }

    this.sessions.delete(userId)
  }

  /**
   * Destroy all sessions for user
   */
  destroyAllSessions(userId: string): void {
    this.destroySession(userId)
  }

  /**
   * Check if token needs refresh
   */
  shouldRefreshToken(token: AuthToken): boolean {
    const timeUntilExpiry = token.expiresAt - Date.now()
    return timeUntilExpiry < this.config.refreshThreshold * 1000
  }

  /**
   * Get user from token
   */
  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const payload = await this.verifyToken(token)

      return {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
      }
    } catch {
      return null
    }
  }

  /**
   * Encode JWT using jose library (Web Crypto API)
   */
  private async encodeJWT(payload: JWTPayload): Promise<string> {
    const secret = new TextEncoder().encode(this.config.jwtSecret)
    const alg = this.config.jwtAlgorithm === 'RS256' ? 'RS256' : this.config.jwtAlgorithm

    const builder = new SignJWT({
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
    })
      .setProtectedHeader({ alg })
      .setSubject(payload.sub)
      .setIssuedAt(payload.iat)
      .setExpirationTime(payload.exp)

    if (payload.iss) builder.setIssuer(payload.iss)
    if (payload.aud) builder.setAudience(payload.aud)

    return builder.sign(secret)
  }

  /**
   * Decode and verify JWT using jose library (Web Crypto API)
   */
  private async decodeJWT(token: string): Promise<JWTPayload> {
    const secret = new TextEncoder().encode(this.config.jwtSecret)
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  }

  /**
   * Generate cryptographically secure refresh token
   */
  private generateRefreshToken(_userId: string): string {
    // Opaque token — userId is stored in the refreshTokens map, not leaked in the token itself
    return randomBytes(32).toString('hex')
  }

  /**
   * Start session cleanup interval
   */
  private startSessionCleanup(): void {
    this.sessionCleanupInterval = setInterval(() => {
      const now = Date.now()

      for (const [userId, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          this.destroySession(userId)
        }
      }
    }, 60000) // Every minute
  }

  /**
   * Stop session cleanup
   */
  destroy(): void {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval)
    }
  }
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
