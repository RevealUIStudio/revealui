/**
 * Auth Server API
 *
 * Server-side authentication functions for Next.js and TanStack Start.
 * Inspired by Better Auth and Neon Auth patterns.
 */

export type { SignInResult, SignUpResult } from '../types.js';
export { isSignupAllowed, signIn, signUp } from './auth.js';
export {
  clearFailedAttempts,
  configureBruteForce,
  getFailedAttemptCount,
  isAccountLocked,
  recordFailedAttempt,
  resetBruteForceConfig,
} from './brute-force.js';
export {
  AuthError,
  AuthenticationError,
  DatabaseError,
  OAuthAccountConflictError,
  SessionError,
  TokenError,
} from './errors.js';
export {
  buildAuthUrl,
  exchangeCode,
  fetchProviderUser,
  generateOAuthState,
  getLinkedProviders,
  linkOAuthAccount,
  type ProviderUser,
  unlinkOAuthAccount,
  upsertOAuthUser,
  verifyOAuthState,
} from './oauth.js';
export type { PasswordResetResult, PasswordResetToken } from './password-reset.js';
export {
  generatePasswordResetToken,
  invalidatePasswordResetToken,
  resetPasswordWithToken,
  validatePasswordResetToken,
} from './password-reset.js';
export {
  meetsMinimumPasswordRequirements,
  validatePasswordStrength,
} from './password-validation.js';
export {
  checkRateLimit,
  configureRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  resetRateLimitConfig,
} from './rate-limit.js';
export type { RequestContext, SessionBindingConfig, SessionData } from './session.js';
export {
  configureSessionBinding,
  createSession,
  deleteAllUserSessions,
  deleteSession,
  getSession,
  resetSessionBindingConfig,
  rotateSession,
  validateSessionBinding,
} from './session.js';
export type { Storage } from './storage/index.js';
export {
  createStorage,
  DatabaseStorage,
  getStorage,
  InMemoryStorage,
  resetStorage,
} from './storage/index.js';
