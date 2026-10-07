/**
 * Signed, exact-candidate review receipts for trusted merge admission.
 *
 * This module verifies receipts produced by an isolated controller. It does
 * not create receipts, fetch PR data, choose trusted keys, or authorize a
 * merge. Callers must obtain expected context and trusted keys from protected
 * configuration and current GitHub API state.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
  sign,
  verify,
} from 'node:crypto';

export const REVIEW_RECEIPT_SCHEMA = 'revealfleet-review-receipt/v1';
const SHA_PATTERN = /^[a-f0-9]{40,64}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_RECEIPT_BYTES = 48 * 1024;

/** Independent, exact-head security evidence required for receipt admission. */
export const REVIEW_RECEIPT_SECURITY_CHECKS = Object.freeze([
  { name: 'CodeQL', appId: 57789 },
  { name: 'Security Gate', appId: 15368 },
  { name: 'Dependency Review', appId: 15368 },
  { name: 'Secret Scanning (Gitleaks)', appId: 15368 },
] as const);

export function hasReviewReceiptSecurityChecks(
  checks: readonly { name: string; appId: number }[],
): boolean {
  const selectors = new Set(checks.map((check) => `${check.appId}:${check.name}`));
  return REVIEW_RECEIPT_SECURITY_CHECKS.every((check) =>
    selectors.has(`${check.appId}:${check.name}`),
  );
}

export interface ReviewReceipt {
  schema: typeof REVIEW_RECEIPT_SCHEMA;
  receiptId: string;
  issuedAt: string;
  expiresAt: string;
  repository: { id: number; fullName: string };
  pullRequest: number;
  head: { sha: string; treeSha: string };
  base: { sha: string; treeSha: string };
  mergeCandidate: { treeSha: string };
  manifest: { sha256: string; fileCount: number };
  policy: { version: string; classifierVersion: string };
  reviews: Array<{
    /** Stable principal ID normalized by the trusted controller across providers. */
    reviewerId: string;
    system: string;
    executionId: string;
    revisionSha: string;
    verdict: 'approve' | 'request-changes';
    criticalFindings: number;
    highFindings: number;
  }>;
  checks: Array<{
    name: string;
    appId: number;
    checkRunId: number;
    checkSuiteId: number;
    conclusion: 'success';
    evidenceSha256: string;
  }>;
  decision: 'approve';
}

export interface ReviewReceiptEnvelope {
  keyId: string;
  receipt: ReviewReceipt;
  signature: string;
}

export interface ReviewReceiptContext {
  repositoryId: number;
  repositoryFullName: string;
  pullRequest: number;
  headSha: string;
  headTreeSha: string;
  baseSha: string;
  baseTreeSha: string;
  mergeCandidateTreeSha: string;
  manifestSha256: string;
  policyVersion: string;
  classifierVersion: string;
  /** Current GitHub API observations, fetched for this exact head SHA. */
  requiredChecks: readonly {
    name: string;
    appId: number;
    checkRunId: number;
    checkSuiteId: number;
  }[];
  minimumIndependentReviews: number;
  maxReceiptLifetimeMs: number;
  now?: Date;
}

export interface ReviewReceiptResult {
  ok: boolean;
  reason?: string;
  receiptId?: string;
}

/** Stable digest for the exact current successful GitHub check observation. */
export function reviewReceiptCheckEvidenceSha256(input: {
  name: string;
  appId: number;
  checkRunId: number;
  checkSuiteId: number;
  headSha: string;
  status: string;
  conclusion: string;
  completedAt: string;
}): string {
  if (
    !(
      isNonEmptyString(input.name, 200) &&
      isSafeInteger(input.appId, 1) &&
      isSafeInteger(input.checkRunId, 1) &&
      isSafeInteger(input.checkSuiteId, 1) &&
      isSha(input.headSha)
    ) ||
    input.status !== 'completed' ||
    input.conclusion !== 'success' ||
    !isNonEmptyString(input.completedAt, 32) ||
    !Number.isFinite(Date.parse(input.completedAt))
  )
    throw new Error('invalid review receipt check evidence');
  return createHash('sha256')
    .update(
      JSON.stringify({
        name: input.name,
        appId: input.appId,
        checkRunId: input.checkRunId,
        checkSuiteId: input.checkSuiteId,
        headSha: input.headSha,
        status: input.status,
        conclusion: input.conclusion,
        completedAt: input.completedAt,
      }),
      'utf8',
    )
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && SHA_PATTERN.test(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 32) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validReviewReceipt(value: unknown): value is ReviewReceipt {
  if (!isRecord(value)) return false;
  if (
    !exactKeys(value, [
      'schema',
      'receiptId',
      'issuedAt',
      'expiresAt',
      'repository',
      'pullRequest',
      'head',
      'base',
      'mergeCandidate',
      'manifest',
      'policy',
      'reviews',
      'checks',
      'decision',
    ]) ||
    value.schema !== REVIEW_RECEIPT_SCHEMA ||
    !isNonEmptyString(value.receiptId, 128) ||
    !isIsoTimestamp(value.issuedAt) ||
    !isIsoTimestamp(value.expiresAt) ||
    value.decision !== 'approve' ||
    !isSafeInteger(value.pullRequest, 1)
  )
    return false;

  const repository = value.repository;
  const head = value.head;
  const base = value.base;
  const candidate = value.mergeCandidate;
  const manifest = value.manifest;
  const policy = value.policy;
  if (
    !(
      isRecord(repository) &&
      exactKeys(repository, ['id', 'fullName']) &&
      isSafeInteger(repository.id, 1) &&
      isNonEmptyString(repository.fullName, 200) &&
      /^[^/\s]+\/[^/\s]+$/.test(repository.fullName) &&
      isRecord(head) &&
      exactKeys(head, ['sha', 'treeSha']) &&
      isSha(head.sha) &&
      isSha(head.treeSha) &&
      isRecord(base) &&
      exactKeys(base, ['sha', 'treeSha']) &&
      isSha(base.sha) &&
      isSha(base.treeSha) &&
      isRecord(candidate) &&
      exactKeys(candidate, ['treeSha']) &&
      isSha(candidate.treeSha) &&
      isRecord(manifest) &&
      exactKeys(manifest, ['sha256', 'fileCount']) &&
      isSha256(manifest.sha256) &&
      isSafeInteger(manifest.fileCount) &&
      isRecord(policy) &&
      exactKeys(policy, ['version', 'classifierVersion']) &&
      isNonEmptyString(policy.version, 128) &&
      isNonEmptyString(policy.classifierVersion, 128) &&
      Array.isArray(value.reviews)
    ) ||
    value.reviews.length > 16 ||
    !Array.isArray(value.checks) ||
    value.checks.length > 128
  )
    return false;

  for (const review of value.reviews) {
    if (
      !(
        isRecord(review) &&
        exactKeys(review, [
          'reviewerId',
          'system',
          'executionId',
          'revisionSha',
          'verdict',
          'criticalFindings',
          'highFindings',
        ]) &&
        isNonEmptyString(review.reviewerId, 128) &&
        isNonEmptyString(review.system, 64) &&
        isNonEmptyString(review.executionId, 128) &&
        isSha(review.revisionSha) &&
        ['approve', 'request-changes'].includes(String(review.verdict)) &&
        isSafeInteger(review.criticalFindings) &&
        isSafeInteger(review.highFindings)
      )
    )
      return false;
  }
  for (const check of value.checks) {
    if (
      !(
        isRecord(check) &&
        exactKeys(check, [
          'name',
          'appId',
          'checkRunId',
          'checkSuiteId',
          'conclusion',
          'evidenceSha256',
        ]) &&
        isNonEmptyString(check.name, 200) &&
        isSafeInteger(check.appId, 1) &&
        isSafeInteger(check.checkRunId, 1) &&
        isSafeInteger(check.checkSuiteId, 1)
      ) ||
      check.conclusion !== 'success' ||
      !isSha256(check.evidenceSha256)
    )
      return false;
  }
  return true;
}

/** Canonical JSON with sorted object keys and preserved array order. */
function canonicalJson(value: unknown): string {
  const normalize = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(normalize);
    if (!isRecord(current)) return current;
    return Object.fromEntries(
      Object.keys(current)
        .sort()
        .map((key) => [key, normalize(current[key])]),
    );
  };
  return JSON.stringify(normalize(value));
}

export function canonicalReviewReceipt(receipt: ReviewReceipt): string {
  return canonicalJson(receipt);
}

/** Sign a validated receipt with the isolated controller's Ed25519 key. */
export function signReviewReceipt(input: {
  keyId: string;
  receipt: ReviewReceipt;
  privateKey: string | Buffer;
  expected: ReviewReceiptContext;
}): ReviewReceiptEnvelope {
  if (!(isNonEmptyString(input.keyId, 128) && validReviewReceipt(input.receipt)))
    throw new Error('invalid review receipt');
  let signingKey: KeyObject;
  try {
    signingKey = createPrivateKey(input.privateKey);
  } catch {
    throw new Error('invalid receipt signing key');
  }
  if (signingKey.asymmetricKeyType !== 'ed25519' || signingKey.type !== 'private')
    throw new Error('receipt signing key must be Ed25519 private key');
  const canonicalReceipt = canonicalReviewReceipt(input.receipt);
  if (Buffer.byteLength(canonicalReceipt, 'utf8') > MAX_RECEIPT_BYTES)
    throw new Error('review receipt size limit');
  const signature = sign(null, Buffer.from(canonicalReceipt, 'utf8'), signingKey);
  const envelope = {
    keyId: input.keyId,
    receipt: input.receipt,
    signature: signature.toString('base64'),
  };
  const publicKey = createPublicKey(signingKey).export({ type: 'spki', format: 'pem' }).toString();
  const verified = verifyReviewReceipt({
    envelope,
    trustedKeys: { [input.keyId]: publicKey },
    expected: input.expected,
  });
  if (!verified.ok) throw new Error(`receipt_not_admissible:${verified.reason}`);
  canonicalReviewReceiptEnvelope(envelope);
  return envelope;
}

/** Serialize the transport envelope without ambiguous field ordering/spacing. */
export function canonicalReviewReceiptEnvelope(envelope: ReviewReceiptEnvelope): string {
  const canonical = canonicalJson(envelope);
  if (Buffer.byteLength(canonical, 'utf8') > MAX_RECEIPT_BYTES)
    throw new Error('review receipt size limit');
  return canonical;
}

/** Parse only canonical transport bytes; duplicate keys and alternate encodings fail closed. */
export function parseReviewReceiptEnvelope(raw: string): unknown {
  if (Buffer.byteLength(raw, 'utf8') > MAX_RECEIPT_BYTES)
    throw new Error('review receipt size limit');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('malformed review receipt JSON');
  }
  if (canonicalJson(value) !== raw) throw new Error('non-canonical review receipt JSON');
  return value;
}

/** Verify signature, exact candidate, current policy and required check producers. */
export function verifyReviewReceipt(input: {
  envelope: unknown;
  trustedKeys: Readonly<Record<string, string>>;
  expected: ReviewReceiptContext;
}): ReviewReceiptResult {
  let envelope = input.envelope;
  if (typeof envelope === 'string') {
    try {
      envelope = parseReviewReceiptEnvelope(envelope);
    } catch (error) {
      return {
        ok: false,
        reason:
          error instanceof Error && error.message.includes('size limit')
            ? 'receipt-size-limit'
            : 'malformed-envelope',
      };
    }
  }
  if (!(isRecord(envelope) && exactKeys(envelope, ['keyId', 'receipt', 'signature'])))
    return { ok: false, reason: 'malformed-envelope' };
  if (!(isNonEmptyString(envelope.keyId, 128) && isNonEmptyString(envelope.signature, 2048)))
    return { ok: false, reason: 'malformed-envelope' };
  if (!validReviewReceipt(envelope.receipt)) return { ok: false, reason: 'malformed-receipt' };

  let serialized: string;
  try {
    serialized = canonicalReviewReceipt(envelope.receipt);
  } catch {
    return { ok: false, reason: 'malformed-receipt' };
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_RECEIPT_BYTES)
    return { ok: false, reason: 'receipt-size-limit' };

  const publicKey = input.trustedKeys[envelope.keyId];
  if (!isNonEmptyString(publicKey, 8192)) return { ok: false, reason: 'untrusted-key' };
  let verificationKey: KeyObject;
  try {
    verificationKey = createPublicKey(publicKey);
  } catch {
    return { ok: false, reason: 'invalid-trusted-key' };
  }
  if (verificationKey.asymmetricKeyType !== 'ed25519')
    return { ok: false, reason: 'unsupported-key-type' };
  try {
    const signature = Buffer.from(envelope.signature, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== envelope.signature)
      return { ok: false, reason: 'malformed-signature' };
    if (!verify(null, Buffer.from(serialized, 'utf8'), verificationKey, signature))
      return { ok: false, reason: 'invalid-signature' };
  } catch {
    return { ok: false, reason: 'invalid-signature' };
  }

  const { expected } = input;
  const now = expected.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return { ok: false, reason: 'invalid-clock' };
  if (
    !(
      isSafeInteger(expected.repositoryId, 1) &&
      /^[^/\s]+\/[^/\s]+$/.test(expected.repositoryFullName) &&
      isSafeInteger(expected.pullRequest, 1) &&
      isSha(expected.headSha) &&
      isSha(expected.headTreeSha) &&
      isSha(expected.baseSha) &&
      isSha(expected.baseTreeSha) &&
      isSha(expected.mergeCandidateTreeSha) &&
      isSha256(expected.manifestSha256) &&
      isNonEmptyString(expected.policyVersion, 128) &&
      isNonEmptyString(expected.classifierVersion, 128) &&
      Number.isSafeInteger(expected.minimumIndependentReviews)
    ) ||
    expected.minimumIndependentReviews < 1 ||
    expected.minimumIndependentReviews > 16 ||
    !Number.isSafeInteger(expected.maxReceiptLifetimeMs) ||
    expected.maxReceiptLifetimeMs < 60_000 ||
    expected.maxReceiptLifetimeMs > 7 * 24 * 60 * 60 * 1000 ||
    !Array.isArray(expected.requiredChecks) ||
    expected.requiredChecks.length === 0 ||
    expected.requiredChecks.length > 128
  )
    return { ok: false, reason: 'invalid-expected-context' };
  const expectedCheckIds = new Set<string>();
  for (const check of expected.requiredChecks) {
    if (
      !(
        isRecord(check) &&
        isNonEmptyString(check.name, 200) &&
        isSafeInteger(check.appId, 1) &&
        isSafeInteger(check.checkRunId, 1) &&
        isSafeInteger(check.checkSuiteId, 1)
      )
    )
      return { ok: false, reason: 'invalid-required-check-policy' };
    const id = `${check.name}\u0000${check.appId}`;
    if (expectedCheckIds.has(id)) return { ok: false, reason: 'duplicate-required-check-policy' };
    expectedCheckIds.add(id);
  }
  const receipt = envelope.receipt;
  if (
    receipt.repository.id !== expected.repositoryId ||
    receipt.repository.fullName !== expected.repositoryFullName ||
    receipt.pullRequest !== expected.pullRequest ||
    receipt.head.sha !== expected.headSha ||
    receipt.head.treeSha !== expected.headTreeSha ||
    receipt.base.sha !== expected.baseSha ||
    receipt.base.treeSha !== expected.baseTreeSha ||
    receipt.mergeCandidate.treeSha !== expected.mergeCandidateTreeSha ||
    receipt.manifest.sha256 !== expected.manifestSha256 ||
    receipt.policy.version !== expected.policyVersion ||
    receipt.policy.classifierVersion !== expected.classifierVersion
  )
    return { ok: false, reason: 'stale-or-wrong-context' };

  const issuedAt = Date.parse(receipt.issuedAt);
  const expiresAt = Date.parse(receipt.expiresAt);
  if (issuedAt > now.getTime() || expiresAt <= now.getTime() || expiresAt <= issuedAt)
    return { ok: false, reason: 'expired-or-invalid-lifetime' };
  if (expiresAt - issuedAt > expected.maxReceiptLifetimeMs)
    return { ok: false, reason: 'receipt-lifetime-limit' };
  if (receipt.reviews.length < expected.minimumIndependentReviews)
    return { ok: false, reason: 'insufficient-independent-reviews' };
  const reviewers = new Set<string>();
  const systems = new Set<string>();
  const executions = new Set<string>();
  for (const review of receipt.reviews) {
    if (review.verdict !== 'approve' || review.revisionSha !== expected.headSha)
      return { ok: false, reason: 'review-hold-or-stale' };
    if (review.criticalFindings > 0 || review.highFindings > 0)
      return { ok: false, reason: 'blocking-findings' };
    if (
      reviewers.has(review.reviewerId) ||
      systems.has(review.system) ||
      executions.has(review.executionId)
    )
      return { ok: false, reason: 'duplicate-reviewers' };
    reviewers.add(review.reviewerId);
    systems.add(review.system);
    executions.add(review.executionId);
  }
  if (reviewers.size < expected.minimumIndependentReviews)
    return { ok: false, reason: 'duplicate-reviewers' };

  const actualChecks = new Map(
    receipt.checks.map((check) => [`${check.name}\u0000${check.appId}`, check]),
  );
  if (actualChecks.size !== receipt.checks.length)
    return { ok: false, reason: 'duplicate-receipt-checks' };
  for (const required of expected.requiredChecks) {
    const check = actualChecks.get(`${required.name}\u0000${required.appId}`);
    if (
      check?.conclusion !== 'success' ||
      check?.checkRunId !== required.checkRunId ||
      check?.checkSuiteId !== required.checkSuiteId
    )
      return { ok: false, reason: 'required-check-missing-or-stale' };
  }
  return { ok: true, receiptId: receipt.receiptId };
}
