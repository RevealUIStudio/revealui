/**
 * Auth Server API
 *
 * Server-side authentication functions for Next.js and TanStack Start.
 * Inspired by Better Auth and Neon Auth patterns.
 */

export type { SignInResult, SignUpResult } from '../types.js';
// GAP-256 admission waitlist (NOT marketing waitlist)
export {
  type EnqueueAdmissionWaitlistParams,
  type EnqueueAdmissionWaitlistResult,
  enqueueAdmissionWaitlist,
  estimateAdmissionWaitlistPosition,
  generateAdmissionToken,
  getAdmissionWaitlistByToken,
  getAdmissionWaitlistByTokenAnyStatus,
  hashAdmissionToken,
  markAdmissionWaitlistConverted,
  maskAdmissionEmail,
} from './admission-waitlist.js';
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
// NOTE (GAP-338): the audit storage boundary lives at the DEDICATED subpath
// `@revealui/auth/audit-storage`, deliberately NOT re-exported from this
// barrel. `@revealui/auth/server` is the fleet's most-mocked module (route
// tests bare-mock it for getSession), and a bare vi.mock of this barrel must
// never swallow the audit write path (it broke the GAP-352 + mcp-endpoint
// integration suites when the boundary briefly lived here).
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
// GAP-256 margin admit (shared admin + server free-intake)
export {
  type AdmitFreeIntakeInput,
  type AdmitFreeIntakeResult,
  admitFreeIntake,
  ensureFreeSignupEntitlement,
  OPEN_FREE_LIMITS,
  provisionHostedPersonalAccount,
} from './margin-admit.js';
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
export { checkSessionMfa, requireMfa, toMfaSession } from './mfa-enforcement.js';
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
  ensurePlatformOperatorEntitlement,
  isPlatformOperatorUser,
  PLATFORM_OPERATOR_LIMITS,
  rolesFromUserJson,
} from './platform-operator.js';
export {
  ensureAccountOwnerPlatformAdmin,
  ensureShellAdminIfAccountOwner,
  isPlatformShellAdminRole,
  PLATFORM_SHELL_ADMIN_COOKIE_ROLES,
  PLATFORM_SHELL_ADMIN_ROLES,
  platformRoleForAccountOwner,
  readUsersRole,
} from './platform-roles.js';
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
// Enterprise SSO pure layer (GAP-464) — OIDC + SAML SP helpers
export {
  type BuildOidcAuthorizationUrlInput,
  type BuildSamlAuthorizeUrlFailureReason,
  type BuildSamlAuthorizeUrlResult,
  buildOidcAuthorizationUrl,
  buildSamlAuthorizeUrl,
  buildSamlSpMetadata,
  createOidcRemoteJwkSet,
  type ExchangeOidcCodeFailureReason,
  type ExchangeOidcCodeInput,
  type ExchangeOidcCodeResult,
  type ExchangeOidcCodeSuccess,
  exchangeOidcCode,
  extractGroupsFromClaim,
  type FetchOidcDiscoveryOptions,
  type FetchOidcDiscoveryResult,
  fetchIdpMetadata,
  fetchOidcDiscovery,
  type GenerateSsoStateInput,
  type GenerateSsoStateResult,
  generateSsoState,
  type JWTPayload,
  type JWTVerifyGetKey,
  type KeyLike,
  type MapSsoGroupsFailureReason,
  type MapSsoGroupsInput,
  type MapSsoGroupsResult,
  mapSsoGroupsToRole,
  normalizeIdpCertPem,
  normalizeSsoUserRole,
  type OidcDiscoveryDocument,
  type OidcDiscoveryFailureReason,
  type ParseIdpMetadataFailureReason,
  type ParseIdpMetadataResult,
  parseIdpMetadataXml,
  type SamlSpConfig,
  type SsoStatePayload,
  type UpsertSsoUserInput,
  upsertSsoUser,
  type ValidatedIdTokenClaims,
  type ValidatedSamlAssertion,
  type ValidateIdTokenFailureReason,
  type ValidateIdTokenResult,
  type ValidateOidcIdTokenOptions,
  type ValidateSamlResponseFailureReason,
  type ValidateSamlResponseResult,
  type VerifiedSsoState,
  validateOidcIdToken,
  validateSamlPostResponse,
  verifySsoState,
} from './sso/index.js';
export type { Storage } from './storage/index.js';
export {
  createStorage,
  DatabaseStorage,
  getStorage,
  InMemoryStorage,
  resetStorage,
} from './storage/index.js';
