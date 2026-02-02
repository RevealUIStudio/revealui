/**
 * Security & Compliance
 *
 * Comprehensive security infrastructure for authentication, authorization,
 * encryption, audit logging, GDPR compliance, and secure headers
 */

// Authentication
export {
  AuthSystem,
  OAuthClient,
  OAuthProviders,
  PasswordHasher,
  TwoFactorAuth,
} from './auth'

export type {
  User,
  AuthToken,
  AuthSession,
  JWTPayload,
  AuthConfig,
  OAuthConfig,
} from './auth'

// Authorization
export {
  AuthorizationSystem,
  authorization,
  CommonRoles,
  PermissionBuilder,
  PolicyBuilder,
  RequirePermission,
  RequireRole,
  createAuthorizationMiddleware,
  canAccessResource,
  checkAttributeAccess,
  PermissionCache,
  permissionCache,
} from './authorization'

export type {
  Permission,
  Role,
  Policy,
  PolicyCondition,
  AuthorizationContext,
} from './authorization'

// Encryption
export {
  EncryptionSystem,
  encryption,
  FieldEncryption,
  KeyRotationManager,
  EnvelopeEncryption,
  DataMasking,
  TokenGenerator,
} from './encryption'

export type {
  EncryptionConfig,
  EncryptedData,
} from './encryption'

// Audit logging
export {
  AuditSystem,
  InMemoryAuditStorage,
  AuditTrail,
  createAuditMiddleware,
  AuditReportGenerator,
  audit,
} from './audit'

export type {
  AuditEventType,
  AuditSeverity,
  AuditEvent,
  AuditQuery,
  AuditStorage,
} from './audit'

// GDPR compliance
export {
  ConsentManager,
  DataExportSystem,
  DataDeletionSystem,
  DataAnonymization,
  PrivacyPolicyManager,
  CookieConsentManager,
  DataBreachManager,
  consentManager,
  dataExportSystem,
  dataDeletionSystem,
  privacyPolicyManager,
  cookieConsentManager,
  dataBreachManager,
} from './gdpr'

export type {
  ConsentType,
  DataCategory,
  ConsentRecord,
  DataProcessingPurpose,
  PersonalDataExport,
  DataDeletionRequest,
  CookieConsentConfig,
  DataBreach,
} from './gdpr'

// Security headers
export {
  SecurityHeaders,
  CORSManager,
  SecurityPresets,
  CORSPresets,
  createSecurityMiddleware,
  setRateLimitHeaders,
} from './headers'

export type {
  SecurityHeadersConfig,
  ContentSecurityPolicyConfig,
  HSTSConfig,
  ReferrerPolicyValue,
  PermissionsPolicyConfig,
  CORSConfig,
} from './headers'
