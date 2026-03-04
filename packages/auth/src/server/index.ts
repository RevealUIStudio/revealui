/**
 * Auth Server API
 *
 * Server-side authentication functions for Next.js and TanStack Start.
 * Inspired by Better Auth and Neon Auth patterns.
 */

export type { SignInResult, SignUpResult } from '../types.js'
export { isSignupAllowed, signIn, signUp } from './auth.js'
export {
  clearFailedAttempts,
  getFailedAttemptCount,
  isAccountLocked,
  recordFailedAttempt,
} from './brute-force.js'
export {
  AuthError,
  AuthenticationError,
  DatabaseError,
  SessionError,
  TokenError,
} from './errors.js'
export {
  buildAuthUrl,
  exchangeCode,
  fetchProviderUser,
  generateOAuthState,
  type ProviderUser,
  upsertOAuthUser,
  verifyOAuthState,
} from './oauth.js'
export type { PasswordResetResult, PasswordResetToken } from './password-reset.js'
export {
  generatePasswordResetToken,
  invalidatePasswordResetToken,
  resetPasswordWithToken,
  validatePasswordResetToken,
} from './password-reset.js'
export {
  meetsMinimumPasswordRequirements,
  validatePasswordStrength,
} from './password-validation.js'
export {
  checkRateLimit,
  getRateLimitStatus,
  resetRateLimit,
} from './rate-limit.js'
export {
  createSession,
  deleteAllUserSessions,
  deleteSession,
  getSession,
} from './session.js'
