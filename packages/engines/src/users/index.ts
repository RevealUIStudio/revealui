/**
 * Users primitive — identity, authentication, sessions, and access control.
 *
 * Re-exports from @revealui/auth, @revealui/db, and @revealui/contracts.
 */

// ── Auth: server-side operations ────────────────────────────────────────────
export {
  signIn,
  signUp,
  isSignupAllowed,
  createSession,
  getSession,
  deleteSession,
  deleteAllUserSessions,
  rotateSession,
  validateSessionBinding,
  isRecoverySession,
  changePassword,
  generatePasswordResetToken,
  resetPasswordWithToken,
  validatePasswordResetToken,
  validatePasswordStrength,
  configureMFA,
  initiateMFASetup,
  verifyMFASetup,
  verifyMFACode,
  disableMFA,
  isMFAEnabled,
  regenerateBackupCodes,
  verifyBackupCode,
  configurePasskey,
  generateRegistrationChallenge,
  verifyRegistration,
  storePasskey,
  generateAuthenticationChallenge,
  verifyAuthentication,
  listPasskeys,
  deletePasskey,
  renamePasskey,
  countUserCredentials,
  buildAuthUrl,
  exchangeCode,
  upsertOAuthUser,
  linkOAuthAccount,
  unlinkOAuthAccount,
  getLinkedProviders,
  verifyOAuthState,
  generateOAuthState,
  configureMagicLink,
  createMagicLink,
  verifyMagicLink,
  configureBruteForce,
  recordFailedAttempt,
  getFailedAttemptCount,
  isAccountLocked,
  clearFailedAttempts,
  configureRateLimit,
  checkRateLimit,
  getRateLimitStatus,
  auditLoginSuccess,
  auditLoginFailure,
  auditPasswordChange,
  auditMfaEnabled,
  auditMfaDisabled,
  auditPasswordReset,
  auditAccountLocked,
  auditSessionRevoked,
  createStorage,
  getStorage,
  DatabaseStorage,
  InMemoryStorage,
  AuthError,
  AuthenticationError,
  SessionError,
  TokenError,
  OAuthAccountConflictError,
} from '@revealui/auth';

// ── Auth: error types (re-exported for convenience) ─────────────────────────
export type {
  SignInResult,
  SignUpResult,
  AuthSession,
  Session,
  User,
} from '@revealui/auth';

// ── Auth: React hooks ───────────────────────────────────────────────────────
export {
  useSession,
  useSignIn,
  useSignUp,
  useSignOut,
  useMFASetup,
  useMFAVerify,
  usePasskeyRegister,
  usePasskeySignIn,
} from '@revealui/auth';

// ── DB: user tables ─────────────────────────────────────────────────────────
export {
  users,
  sessions,
  passwordResetTokens,
  passkeys,
  magicLinks,
  failedAttempts,
  oauthAccounts,
} from '@revealui/db';

// ── Contracts: user schemas & types ─────────────────────────────────────────
export {
  type CreateUserInput,
  CreateUserInputSchema,
  createUser,
  USER_SCHEMA_VERSION,
  type UpdateUserInput,
  UpdateUserInputSchema,
  type UserPreferences,
  UserPreferencesSchema,
  type UserRole,
  UserRoleSchema,
  UserSchema,
  type UserStatus,
  UserStatusSchema,
  type UserType,
  UserTypeSchema,
} from '@revealui/contracts';
