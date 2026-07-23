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
// Merkle roots over row signatures (GAP-355 Stage 4 S4-2)
export type {
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
