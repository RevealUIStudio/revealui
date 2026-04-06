/**
 * Auth Server API
 *
 * Server-side authentication functions for Next.js and TanStack Start.
 * Inspired by Better Auth and Neon Auth patterns.
 */

export type { SignInResult, SignUpResult } from '../types.js';
// Audit bridge
export {
  auditAccountLocked,
  auditLoginFailure,
  auditLoginSuccess,
  auditMfaDisabled,
  auditMfaEnabled,
  auditPasswordChange,
  auditPasswordReset,
  auditSessionRevoked,
} from './audit-bridge.js';
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
// Magic Link
export type { MagicLinkConfig } from './magic-link.js';
export {
  configureMagicLink,
  createMagicLink,
  resetMagicLinkConfig,
  verifyMagicLink,
} from './magic-link.js';
export type { MFAConfig, MFADisableProof, MFASetupResult } from './mfa.js';
export {
  configureMFA,
  disableMFA,
  initiateMFASetup,
  isMFAEnabled,
  regenerateBackupCodes,
  resetMFAConfig,
  verifyBackupCode,
  verifyMFACode,
  verifyMFASetup,
} from './mfa.js';
// MFA Enforcement
export type {
  MfaCheckResult,
  MfaEnforcementOptions,
  MfaErrorResponse,
  MfaRequest,
  MfaSession,
  MfaSessionUser,
} from './mfa-enforcement.js';
export { requireMfa } from './mfa-enforcement.js';
export {
  buildAuthUrl,
  exchangeCode,
  fetchProviderUser,
  generateOAuthState,
  getLinkedProviders,
  linkOAuthAccount,
  type ProviderUser,
  type UpsertOAuthOptions,
  unlinkOAuthAccount,
  upsertOAuthUser,
  verifyOAuthState,
} from './oauth.js';
// Passkey
export type { PasskeyConfig } from './passkey.js';
export {
  configurePasskey,
  countUserCredentials,
  deletePasskey,
  generateAuthenticationChallenge,
  generateRegistrationChallenge,
  listPasskeys,
  renamePasskey,
  resetPasskeyConfig,
  storePasskey,
  verifyAuthentication,
  verifyRegistration,
} from './passkey.js';
export type {
  ChangePasswordResult,
  PasswordResetResult,
  PasswordResetToken,
} from './password-reset.js';
export {
  changePassword,
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
  deleteOtherUserSessions,
  deleteSession,
  getSession,
  isRecoverySession,
  resetSessionBindingConfig,
  rotateSession,
  validateSessionBinding,
} from './session.js';
// Signed Cookie
export { signCookiePayload, verifyCookiePayload } from './signed-cookie.js';
export type { Storage } from './storage/index.js';
export {
  createStorage,
  DatabaseStorage,
  getStorage,
  InMemoryStorage,
  resetStorage,
} from './storage/index.js';
