/**
 * Auth Server API
 *
 * Server-side authentication functions for Next.js and TanStack Start.
 * Inspired by Better Auth and Neon Auth patterns.
 */

export type { SignInResult, SignUpResult } from '../types'
export { signIn, signUp } from './auth'
export {
  clearFailedAttempts,
  getFailedAttemptCount,
  isAccountLocked,
  recordFailedAttempt,
} from './brute-force'
export { AuthError, AuthenticationError, DatabaseError, SessionError, TokenError } from './errors'
export type { PasswordResetResult, PasswordResetToken } from './password-reset'
export {
  generatePasswordResetToken,
  invalidatePasswordResetToken,
  resetPasswordWithToken,
  validatePasswordResetToken,
} from './password-reset'
export { meetsMinimumPasswordRequirements, validatePasswordStrength } from './password-validation'
export { checkRateLimit, getRateLimitStatus, resetRateLimit } from './rate-limit'
export { createSession, deleteAllUserSessions, deleteSession, getSession } from './session'
