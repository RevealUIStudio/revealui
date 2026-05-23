/**
 * Security & Compliance — server-only entry.
 *
 * Modules that depend on Node built-ins live here, behind the explicit
 * `@revealui/security/server` subpath, so the package's default barrel (`.`)
 * stays client-bundle-safe:
 *   - authentication (auth.ts) — `node:crypto` (TOTP HMAC)
 *   - GDPR managers (gdpr.ts) — `node:crypto`
 *   - audit logging (audit.ts) — `node:crypto`
 *   - SSRF / DNS resolution (ssrf.ts) — `node:dns`
 *
 * Importing this entry from a browser/RSC client bundle pulls the `node:` graph
 * in and crashes the bundle — the `validate:client-safety` gate enforces that
 * client-reachable code never imports it.
 *
 * @packageDocumentation
 */

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
  TwoFactorAuth,
} from './auth.js';
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
// SSRF protection
export {
  assertPublicUrl,
  createSafeFetch,
  isPrivateIp,
  isPrivateIpv4,
  isPrivateIpv6,
  type SafeFetchOptions,
} from './ssrf.js';
