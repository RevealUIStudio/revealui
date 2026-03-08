/**
 * Security & Compliance
 *
 * Security infrastructure for authentication, authorization,
 * encryption, audit logging, GDPR compliance, and secure headers.
 */

export type {
  AuditEvent,
  AuditEventType,
  AuditQuery,
  AuditSeverity,
  AuditStorage,
} from './audit'
// Audit logging
export {
  AuditReportGenerator,
  AuditSystem,
  AuditTrail,
  audit,
  createAuditMiddleware,
  InMemoryAuditStorage,
} from './audit'
export type {
  AuthConfig,
  AuthSession,
  AuthToken,
  JWTPayload,
  OAuthConfig,
  User,
} from './auth'
// Authentication
export {
  AuthSystem,
  OAuthClient,
  OAuthProviders,
  PasswordHasher,
  TwoFactorAuth,
} from './auth'
export type {
  AuthorizationContext,
  Permission,
  Policy,
  PolicyCondition,
  Role,
} from './authorization'
// Authorization
export {
  AuthorizationSystem,
  authorization,
  CommonRoles,
  canAccessResource,
  checkAttributeAccess,
  createAuthorizationMiddleware,
  PermissionBuilder,
  PermissionCache,
  PolicyBuilder,
  permissionCache,
  RequirePermission,
  RequireRole,
} from './authorization'
export type {
  EncryptedData,
  EncryptionConfig,
} from './encryption'
// Encryption
export {
  DataMasking,
  EncryptionSystem,
  EnvelopeEncryption,
  encryption,
  FieldEncryption,
  KeyRotationManager,
  TokenGenerator,
} from './encryption'
export type {
  ConsentRecord,
  ConsentType,
  CookieConsentConfig,
  DataBreach,
  DataCategory,
  DataDeletionRequest,
  DataProcessingPurpose,
  PersonalDataExport,
} from './gdpr'
// GDPR compliance
export {
  ConsentManager,
  CookieConsentManager,
  consentManager,
  cookieConsentManager,
  DataAnonymization,
  DataBreachManager,
  DataDeletionSystem,
  DataExportSystem,
  dataBreachManager,
  dataDeletionSystem,
  dataExportSystem,
  PrivacyPolicyManager,
  privacyPolicyManager,
} from './gdpr'
export type { GDPRStorage } from './gdpr-storage'
// GDPR storage abstraction
export { InMemoryGDPRStorage } from './gdpr-storage'
export type {
  CORSConfig,
  ContentSecurityPolicyConfig,
  HSTSConfig,
  PermissionsPolicyConfig,
  ReferrerPolicyValue,
  SecurityHeadersConfig,
} from './headers'
// Security headers
export {
  CORSManager,
  CORSPresets,
  createSecurityMiddleware,
  SecurityHeaders,
  SecurityPresets,
  setRateLimitHeaders,
} from './headers'
