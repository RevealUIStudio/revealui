/**
 * Security & Compliance — client-safe barrel.
 *
 * The default entry (`.`) re-exports only modules free of `node:` built-ins, so
 * it is safe in any bundle (browser, RSC, server): alerting, authorization,
 * encryption (Web Crypto), GDPR storage, headers, logger, request-IP, and input
 * sanitization.
 *
 * Server-only modules that pull `node:` built-ins — authentication (node:crypto),
 * GDPR managers (node:crypto), audit logging (node:crypto), and SSRF/DNS
 * (node:dns) — live behind the explicit `@revealui/security/server` subpath so a
 * client/RSC bundle never drags the node: graph in (the crash class fixed by
 * #1046). `@revealui/core/security` re-exports both this barrel and `./server`,
 * so server consumers that go through core are unaffected. The `./sanitize`
 * subpath remains the minimal client-safe surface for URL/HTML helpers.
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
// Encryption (Web Crypto — no node: built-ins)
export {
  DataMasking,
  EncryptionSystem,
  EnvelopeEncryption,
  encryption,
  FieldEncryption,
  KeyRotationManager,
  TokenGenerator,
} from './encryption.js';
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
// RFC 8785 JSON canonicalization (pure — no node: built-ins)
export { canonicalizeJcs } from './jcs.js';
// Logger configuration
export type { SecurityLogger } from './logger.js';
export { configureSecurityLogger } from './logger.js';
// Request IP (trusted-proxy-aware)
export type { ClientIpConfig } from './request-ip.js';
export { configureClientIp, getClientIp, resetClientIpConfig } from './request-ip.js';
// Input sanitization
export {
  escapeShellArg,
  escapeSqlIdentifier,
  isSafeUrl,
  isSensitiveLogKey,
  REDACTED,
  redactLogContext,
  redactLogField,
  redactSecretsInString,
  type SanitizeHtmlOptions,
  type ShellDialect,
  sanitizeHtml,
  sanitizeTerminalLine,
  sanitizeUrl,
  type UrlContext,
} from './sanitize.js';
