/**
 * Authentication System
 *
 * JWT-based authentication with session management, token refresh, and OAuth support
 */

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
 * Authentication system
 */
export class AuthSystem {
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
    email: string,
    password: string,
    deviceInfo?: AuthSession['deviceInfo'],
  ): Promise<{ user: User; token: AuthToken; session: AuthSession }> {
    // This would integrate with your authentication backend
    // For now, this is a placeholder implementation
    throw new Error('Implement authenticate() with your auth backend')
  }

  /**
   * Create JWT token
   */
  createToken(user: User, expiresIn: number = this.config.accessTokenExpiry): AuthToken {
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

    // In production, use a proper JWT library like jsonwebtoken
    const accessToken = this.encodeJWT(payload)

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
  verifyToken(token: string): JWTPayload {
    try {
      const payload = this.decodeJWT(token)

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
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    const session = Array.from(this.sessions.values()).find(
      (s) => s.user.id === userId,
    )

    if (!session) {
      throw new Error('Session not found')
    }

    // Create new access token
    return this.createToken(session.user)
  }

  /**
   * Create session
   */
  createSession(
    user: User,
    token: AuthToken,
    deviceInfo?: AuthSession['deviceInfo'],
  ): AuthSession {
    const now = Date.now()

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
  getUserFromToken(token: string): User | null {
    try {
      const payload = this.verifyToken(token)

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
   * Encode JWT (simplified - use jsonwebtoken in production)
   */
  private encodeJWT(payload: JWTPayload): string {
    // This is a simplified implementation
    // In production, use a proper JWT library like jsonwebtoken
    const header = { alg: this.config.jwtAlgorithm, typ: 'JWT' }
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload))
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`)

    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  /**
   * Decode JWT (simplified - use jsonwebtoken in production)
   */
  private decodeJWT(token: string): JWTPayload {
    const parts = token.split('.')

    if (parts.length !== 3) {
      throw new Error('Invalid token format')
    }

    const [encodedHeader, encodedPayload, signature] = parts

    // Verify signature
    const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`)
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature')
    }

    return JSON.parse(this.base64UrlDecode(encodedPayload))
  }

  /**
   * Sign data with secret
   */
  private sign(data: string): string {
    // This is a simplified implementation
    // In production, use proper HMAC signing
    const crypto = globalThis.crypto
    if (!crypto) {
      throw new Error('Crypto API not available')
    }

    // For demonstration only - use proper signing in production
    return this.base64UrlEncode(data + this.config.jwtSecret)
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(str: string): string {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    }

    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Base64 URL decode
   */
  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/')

    // Add padding
    while (base64.length % 4) {
      base64 += '='
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString()
    }

    return atob(base64)
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string): string {
    const crypto = globalThis.crypto
    if (!crypto) {
      throw new Error('Crypto API not available')
    }

    // Generate random token
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const token = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')

    return `${userId}.${token}`
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
    this.config = {
      ...config,
      ...OAuthProviders[config.provider as keyof typeof OAuthProviders],
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
 */
export class PasswordHasher {
  /**
   * Hash password
   */
  static async hash(password: string): Promise<string> {
    // In production, use bcrypt or argon2
    // This is a simplified implementation for demonstration
    const crypto = globalThis.crypto
    if (!crypto) {
      throw new Error('Crypto API not available')
    }

    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Verify password
   */
  static async verify(password: string, hash: string): Promise<boolean> {
    const computed = await this.hash(password)
    return computed === hash
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
    return this.base32Encode(buffer)
  }

  /**
   * Generate TOTP code
   */
  static generateCode(secret: string, timestamp?: number): string {
    // Simplified TOTP implementation
    // In production, use a library like otplib
    const time = Math.floor((timestamp || Date.now()) / 30000)
    const hmac = this.hmac(secret, time.toString())
    const offset = hmac.charCodeAt(hmac.length - 1) & 0x0f
    const code = (
      ((hmac.charCodeAt(offset) & 0x7f) << 24) |
      ((hmac.charCodeAt(offset + 1) & 0xff) << 16) |
      ((hmac.charCodeAt(offset + 2) & 0xff) << 8) |
      (hmac.charCodeAt(offset + 3) & 0xff)
    ) % 1000000

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
      const testCode = this.generateCode(secret, testTime)

      if (testCode === code) {
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

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i]
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
   * Simple HMAC implementation
   */
  private static hmac(key: string, message: string): string {
    // Simplified for demonstration - use proper crypto.subtle.sign in production
    return key + message
  }
}
