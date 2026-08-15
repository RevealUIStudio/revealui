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
  AuditWriteError,
  audit,
  createAuditMiddleware,
  InMemoryAuditStorage,
} from './audit.js';
// Offline anchor verify (GAP-355 Stage 4 S4-5; GAP-447 live burned-seq recheck)
export type {
  OfflineAnchorRecord,
  OfflineInclusionProofInput,
  OfflineVerifyInput,
  OfflineVerifyResult,
  SeqExistsChecker,
} from './audit-anchor-verify.js';
export { verifyAuditAnchorOffline } from './audit-anchor-verify.js';
// Merkle roots over row signatures (GAP-355 Stage 4 S4-2; GAP-447 holes)
export type {
  AuditAnchorHoles,
  AuditAnchorSignable,
  InclusionProof,
  MerkleBuildResult,
} from './audit-merkle.js';
export {
  assertContiguousSeq,
  auditAnchorSignableBytes,
  buildInclusionProof,
  buildMerkleRootFromSignatures,
  hashAuditSignatureLeaf,
  hashMerklePair,
  signAuditAnchorRoot,
  verifyAuditAnchorRoot,
  verifyInclusionProof,
} from './audit-merkle.js';
// Env-composed audit signer + public-key resolution (GAP-355 Stage 3, D4/D5)
export type {
  AuditRowSignerFn,
  AuditSignerEnv,
  AuditSignerResolution,
  ResolvedAuditPublicKey,
} from './audit-signer-env.js';
export {
  createAuditRowSignerFromEnv,
  deriveAuditKid,
  normalizeEnvPem,
  resolveAuditPublicKey,
} from './audit-signer-env.js';
// Per-row Ed25519 audit signing (GAP-355 Stage 3 — node:crypto)
export type {
  AuditRowSigner,
  AuditSignable,
  AuditSignatureKind,
  Ed25519VerifyResult,
  PublicKeyResolver,
} from './audit-signing.js';
export {
  auditSignableBytes,
  auditTimestampString,
  classifyAuditSignature,
  Ed25519AuditRowSigner,
  verifyAuditRow,
  verifyEd25519AuditSignature,
} from './audit-signing.js';
export type { AuditWriteFailureReason } from './audit-write-failures.js';
export {
  classifyAuditWriteFailure,
  recordAuditWriteResult,
} from './audit-write-failures.js';
// Authentication (TOTP only — OAuthClient/OAuthProviders removed P2-B; use @revealui/auth)
export { TwoFactorAuth } from './auth.js';
export type { ComplianceProfile, ComplianceProfileId } from './compliance-profile.js';
export {
  HIPAA_COMPLIANCE_PROFILE,
  HIPAA_IDLE_TIMEOUT_SECONDS,
  isHipaaProfile,
  parseComplianceProfileId,
  resolveComplianceProfile,
  STANDARD_COMPLIANCE_PROFILE,
} from './compliance-profile.js';
export type {
  CookieConsentConfig,
  CookieConsentRecord,
  CookieConsentSource,
} from './cookie-consent.js';
export {
  ACCEPTED_ALL_CONSENT,
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_CONSENT_VERSION,
  CookieConsentManager,
  cookieConsentManager,
  DENIED_OPTIONAL_CONSENT,
  detectPrivacySignal,
  hasAnalyticsConsent,
  parseCookieConsent,
  serializeCookieConsent,
} from './cookie-consent.js';
export type {
  ConsentRecord,
  ConsentType,
  DataBreach,
  DataCategory,
  DataDeletionRequest,
  DataProcessingPurpose,
  PersonalDataExport,
} from './gdpr.js';
// GDPR compliance
export {
  ConsentManager,
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
export type {
  HipaaBaaStatus,
  HipaaSurface,
  HipaaSurfaceId,
  HipaaVendorOption,
} from './hipaa-surfaces.js';
export {
  getHipaaSurface,
  HIPAA_GMAIL_API_VENDOR_ID,
  HIPAA_SURFACES,
  isHipaaVendorAllowed,
  listHipaaBlockedDefaultVendors,
} from './hipaa-surfaces.js';
export type {
  PolicySignerEnv,
  PolicySnapshotSignerResolution,
} from './policy-snapshot-signer-env.js';
export { createPolicySnapshotSignerFromEnv } from './policy-snapshot-signer-env.js';
// GAP-381 policy snapshot Ed25519 (I-5 enforced tier honesty)
export type {
  PolicySnapshotDocument,
  PolicySnapshotSignable,
} from './policy-snapshot-signing.js';
export {
  createPolicySnapshotSigner,
  policyPublicKeyFromPem,
  policySnapshotSignableBytes,
  signPolicySnapshot,
  UNSIGNED_POLICY_KEY_ID,
  UNSIGNED_POLICY_SIGNATURE,
  verifyPolicySnapshot,
} from './policy-snapshot-signing.js';
// SSRF protection
export {
  assertPublicUrl,
  createSafeFetch,
  isPrivateIp,
  isPrivateIpv4,
  isPrivateIpv6,
  type SafeFetchOptions,
} from './ssrf.js';
