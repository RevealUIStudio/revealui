/**
 * Security & Compliance
 *
 * Security infrastructure for authentication, authorization,
 * encryption, audit logging, GDPR compliance, and secure headers.
 *
 * @packageDocumentation
 */

export type {
  AlertHandler,
  AlertingConfig,
  SecurityAlert,
  ThresholdRule,
} from './alerting.js';
// Security alerting
export {
  AuditAlertHandler,
  DEFAULT_THRESHOLDS,
  LogAlertHandler,
  SecurityAlertService,
  WebhookAlertHandler,
} from './alerting.js';
export type {
  AuditEvent,
  AuditEventType,
  AuditQuery,
  AuditSeverity,
  AuditStorage,
} from './audit.js';
// Audit logging
export {
  AuditReportGenerator,
  AuditSystem,
  AuditTrail,
  audit,
  createAuditMiddleware,
  InMemoryAuditStorage,
  signAuditEntry,
  verifyAuditEntry,
} from './audit.js';
export type {
  OAuthConfig,
  User,
} from './auth.js';
// Authentication
export {
  OAuthClient,
  OAuthProviders,
  PasswordHasher,
  TwoFactorAuth,
} from './auth.js';
export type {
  AuthorizationContext,
  Permission,
  Policy,
  PolicyCondition,
  Role,
} from './authorization.js';
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
} from './authorization.js';
export type {
  EncryptedData,
  EncryptionConfig,
} from './encryption.js';
// Encryption
export {
  DataMasking,
  EncryptionSystem,
  EnvelopeEncryption,
  encryption,
  FieldEncryption,
  KeyRotationManager,
  TokenGenerator,
} from './encryption.js';
export type {
  ConsentRecord,
  ConsentType,
  CookieConsentConfig,
  DataBreach,
  DataCategory,
  DataDeletionRequest,
  DataProcessingPurpose,
  PersonalDataExport,
} from './gdpr.js';
// GDPR compliance
export {
  ConsentManager,
  CookieConsentManager,
  cookieConsentManager,
  createConsentManager,
  createDataBreachManager,
  createDataDeletionSystem,
  DataAnonymization,
  DataBreachManager,
  DataDeletionSystem,
  DataExportSystem,
  dataExportSystem,
  PrivacyPolicyManager,
  privacyPolicyManager,
} from './gdpr.js';
export type { BreachStorage, GDPRStorage } from './gdpr-storage.js';
// GDPR storage abstraction
export { InMemoryBreachStorage, InMemoryGDPRStorage } from './gdpr-storage.js';
export type {
  CORSConfig,
  ContentSecurityPolicyConfig,
  HSTSConfig,
  PermissionsPolicyConfig,
  ReferrerPolicyValue,
  SecurityHeadersConfig,
} from './headers.js';
// Security headers
export {
  CORSManager,
  CORSPresets,
  createSecurityMiddleware,
  SecurityHeaders,
  SecurityPresets,
  setRateLimitHeaders,
} from './headers.js';
// Logger configuration
export type { SecurityLogger } from './logger.js';
export { configureSecurityLogger } from './logger.js';
