/**
 * Auth Server API
 *
 * Server-side authentication functions for Next.js and TanStack Start.
 * Inspired by Better Auth and Neon Auth patterns.
 */

export { getSession, createSession, deleteSession, deleteAllUserSessions } from './session'
export { signIn, signUp } from './auth'
export type { SignInResult, SignUpResult } from '../types'
export { AuthError, SessionError, AuthenticationError, DatabaseError, TokenError } from './errors'
export { checkRateLimit, resetRateLimit, getRateLimitStatus } from './rate-limit'
export { isAccountLocked, recordFailedAttempt, clearFailedAttempts, getFailedAttemptCount } from './brute-force'
export { validatePasswordStrength, meetsMinimumPasswordRequirements } from './password-validation'
export { generatePasswordResetToken, validatePasswordResetToken, resetPasswordWithToken, invalidatePasswordResetToken } from './password-reset'
export type { PasswordResetToken, PasswordResetResult } from './password-reset'