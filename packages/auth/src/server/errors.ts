/**
 * Authentication Error Types
 *
 * Custom error classes for authentication operations.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class SessionError extends AuthError {
  constructor(message: string = 'Session error', statusCode: number = 401) {
    super(message, 'SESSION_ERROR', statusCode)
    this.name = 'SessionError'
  }
}

export class AuthenticationError extends AuthError {
  constructor(message: string = 'Authentication failed', statusCode: number = 401) {
    super(message, 'AUTHENTICATION_ERROR', statusCode)
    this.name = 'AuthenticationError'
  }
}

export class DatabaseError extends AuthError {
  public originalError?: Error

  constructor(message: string = 'Database error', originalError?: unknown) {
    super(message, 'DATABASE_ERROR', 500)
    this.name = 'DatabaseError'
    if (originalError instanceof Error) {
      this.originalError = originalError
    }
  }
}

export class TokenError extends AuthError {
  constructor(message: string = 'Token error', statusCode: number = 401) {
    super(message, 'TOKEN_ERROR', statusCode)
    this.name = 'TokenError'
  }
}

export class OAuthAccountConflictError extends AuthError {
  public email: string

  constructor(email: string) {
    super(
      'An account with this email already exists. Sign in with your password or original provider.',
      'OAUTH_ACCOUNT_CONFLICT',
      409,
    )
    this.name = 'OAuthAccountConflictError'
    this.email = email
  }
}
