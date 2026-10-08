import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonicalReviewReceipt,
  canonicalReviewReceiptEnvelope,
  REVIEW_RECEIPT_SCHEMA,
  type ReviewReceipt,
  type ReviewReceiptContext,
  reviewReceiptCheckEvidenceSha256,
  signReviewReceipt,
  verifyReviewReceipt,
} from '../review-receipt.js';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = new Date('2026-10-06T12:00:00.000Z');
const sha = (char: string) => char.repeat(40);
const digest = (char: string) => char.repeat(64);

const expected: ReviewReceiptContext = {
  repositoryId: 1234,
  repositoryFullName: 'RevealUIStudio/revealui',
  pullRequest: 3054,
  headSha: sha('a'),
  headTreeSha: sha('b'),
  baseSha: sha('c'),
  baseTreeSha: sha('d'),
  mergeCandidateTreeSha: sha('e'),
  manifestSha256: digest('f'),
  policyVersion: 'review-policy-1',
  classifierVersion: 'security-paths-1',
  requiredChecks: [
    { name: 'CI', appId: 77, checkRunId: 101, checkSuiteId: 201 },
    { name: 'Security', appId: 77, checkRunId: 102, checkSuiteId: 202 },
  ],
  minimumIndependentReviews: 2,
  maxReceiptLifetimeMs: 6 * 60 * 60 * 1000,
  now,
};

describe('review receipt check evidence digest', () => {
  const current = {
    name: 'CI',
    appId: 77,
    checkRunId: 101,
    checkSuiteId: 201,
    headSha: sha('a'),
    status: 'completed',
    conclusion: 'success',
    completedAt: '2026-10-06T11:55:00Z',
  };

  it('is stable for one current run and changes when the same check is rerun', () => {
    const original = reviewReceiptCheckEvidenceSha256(current);
    expect(reviewReceiptCheckEvidenceSha256(current)).toBe(original);
    expect(
      reviewReceiptCheckEvidenceSha256({ ...current, completedAt: '2026-10-06T12:05:00Z' }),
    ).not.toBe(original);
  });

  it('rejects non-successful or incomplete observations', () => {
    expect(() => reviewReceiptCheckEvidenceSha256({ ...current, conclusion: 'failure' })).toThrow(
      'invalid review receipt check evidence',
    );
    expect(() =>
      reviewReceiptCheckEvidenceSha256({ ...current, completedAt: 'not-a-time' }),
    ).toThrow('invalid review receipt check evidence');
  });
});

function receipt(overrides: Partial<ReviewReceipt> = {}): ReviewReceipt {
  return {
    schema: REVIEW_RECEIPT_SCHEMA,
    receiptId: 'receipt-3054-1',
    issuedAt: '2026-10-06T11:00:00.000Z',
    expiresAt: '2026-10-06T17:00:00.000Z',
    repository: { id: expected.repositoryId, fullName: expected.repositoryFullName },
    pullRequest: expected.pullRequest,
    head: { sha: expected.headSha, treeSha: expected.headTreeSha },
    base: { sha: expected.baseSha, treeSha: expected.baseTreeSha },
    mergeCandidate: { treeSha: expected.mergeCandidateTreeSha },
    manifest: { sha256: expected.manifestSha256, fileCount: 4 },
    policy: { version: expected.policyVersion, classifierVersion: expected.classifierVersion },
    reviews: [
      {
        reviewerId: 'reviewer-a',
        system: 'review-model-a',
        executionId: 'execution-a',
        revisionSha: expected.headSha,
        verdict: 'approve',
        criticalFindings: 0,
        highFindings: 0,
      },
      {
        reviewerId: 'reviewer-b',
        system: 'review-model-b',
        executionId: 'execution-b',
        revisionSha: expected.headSha,
        verdict: 'approve',
        criticalFindings: 0,
        highFindings: 0,
      },
    ],
    checks: [
      {
        name: 'CI',
        appId: 77,
        checkRunId: 101,
        checkSuiteId: 201,
        conclusion: 'success',
        evidenceSha256: digest('1'),
      },
      {
        name: 'Security',
        appId: 77,
        checkRunId: 102,
        checkSuiteId: 202,
        conclusion: 'success',
        evidenceSha256: digest('2'),
      },
    ],
    decision: 'approve',
    ...overrides,
  };
}

function envelope(value = receipt()) {
  const canonical = canonicalReviewReceipt(value);
  return {
    keyId: 'controller-2026-01',
    receipt: value,
    signature: sign(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64'),
  };
}

function envelopeBytes(value = envelope()) {
  return canonicalReviewReceiptEnvelope(value);
}

function verifyReceipt(
  value: unknown,
  context = expected,
  keys: Record<string, string> = { 'controller-2026-01': publicKeyPem },
) {
  return verifyReviewReceipt({ envelope: value, expected: context, trustedKeys: keys });
}

describe('verifyReviewReceipt', () => {
  it('signs the canonical validated receipt and rejects invalid signer material', () => {
    const signed = signReviewReceipt({
      keyId: 'controller-2026-01',
      receipt: receipt(),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      expected,
    });
    expect(verifyReceipt(signed)).toEqual({ ok: true, receiptId: 'receipt-3054-1' });
    expect(() =>
      signReviewReceipt({
        keyId: 'controller-2026-01',
        receipt: receipt(),
        privateKey: 'bad key',
        expected,
      }),
    ).toThrow('invalid receipt signing key');
    expect(() =>
      signReviewReceipt({
        keyId: 'controller-2026-01',
        receipt: receipt({ pullRequest: 0 }),
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        expected,
      }),
    ).toThrow('invalid review receipt');
  });

  it('accepts an independently signed receipt bound to exact PR, candidate, policy, and required checks', () => {
    const signed = envelope();
    expect(verifyReceipt(envelopeBytes(signed))).toEqual({ ok: true, receiptId: 'receipt-3054-1' });
  });

  it('rejects a changed signed field and an untrusted signer', () => {
    const signed = envelope();
    expect(
      verifyReceipt({ ...signed, receipt: { ...signed.receipt, pullRequest: 3055 } }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid-signature',
    });
    expect(verifyReceipt(signed, expected, {})).toMatchObject({
      ok: false,
      reason: 'untrusted-key',
    });
  });

  it.each([
    ['repository', { ...expected, repositoryId: 4321 }],
    ['PR', { ...expected, pullRequest: 3055 }],
    ['head', { ...expected, headSha: sha('9') }],
    ['head tree', { ...expected, headTreeSha: sha('9') }],
    ['base', { ...expected, baseSha: sha('9') }],
    ['merge candidate', { ...expected, mergeCandidateTreeSha: sha('9') }],
    ['manifest', { ...expected, manifestSha256: digest('9') }],
    ['policy', { ...expected, policyVersion: 'weakened-policy' }],
  ])('rejects replay against a different %s', (_field, context) => {
    expect(verifyReceipt(envelope(), context)).toMatchObject({
      ok: false,
      reason: 'stale-or-wrong-context',
    });
  });

  it('rejects expired receipts and lifetimes longer than six hours', () => {
    expect(
      verifyReceipt(envelope(receipt({ expiresAt: '2026-10-06T12:00:00.000Z' }))),
    ).toMatchObject({
      ok: false,
      reason: 'expired-or-invalid-lifetime',
    });
    expect(
      verifyReceipt(envelope(receipt({ expiresAt: '2026-10-06T18:00:01.000Z' }))),
    ).toMatchObject({
      ok: false,
      reason: 'receipt-lifetime-limit',
    });
  });

  it('requires the policy number of distinct reviewer identities and executions', () => {
    const oneReviewer = receipt({ reviews: [receipt().reviews[0]] });
    expect(verifyReceipt(envelope(oneReviewer))).toMatchObject({
      ok: false,
      reason: 'insufficient-independent-reviews',
    });

    const duplicateIdentity = receipt({
      reviews: [receipt().reviews[0], { ...receipt().reviews[1], reviewerId: 'reviewer-a' }],
    });
    expect(verifyReceipt(envelope(duplicateIdentity))).toMatchObject({
      ok: false,
      reason: 'duplicate-reviewers',
    });

    const duplicateExecution = receipt({
      reviews: [receipt().reviews[0], { ...receipt().reviews[1], executionId: 'execution-a' }],
    });
    expect(verifyReceipt(envelope(duplicateExecution))).toMatchObject({
      ok: false,
      reason: 'duplicate-reviewers',
    });

    const duplicateSystem = receipt({
      reviews: [receipt().reviews[0], { ...receipt().reviews[1], system: 'review-model-a' }],
    });
    expect(verifyReceipt(envelope(duplicateSystem))).toMatchObject({
      ok: false,
      reason: 'duplicate-reviewers',
    });
  });

  it('rejects stale or negative reviews and critical/high findings', () => {
    for (const review of [
      { ...receipt().reviews[0], verdict: 'request-changes' as const },
      { ...receipt().reviews[0], revisionSha: sha('9') },
      { ...receipt().reviews[0], criticalFindings: 1 },
      { ...receipt().reviews[0], highFindings: 1 },
    ]) {
      const value = receipt({ reviews: [review, receipt().reviews[1]] });
      expect(verifyReceipt(envelope(value)).ok).toBe(false);
    }
  });

  it('requires every check from its policy-bound App identity', () => {
    const missing = receipt({ checks: [receipt().checks[0]] });
    expect(verifyReceipt(envelope(missing))).toMatchObject({
      ok: false,
      reason: 'required-check-missing-or-stale',
    });

    const wrongProducer = receipt({
      checks: [receipt().checks[0], { ...receipt().checks[1], appId: 78 }],
    });
    expect(verifyReceipt(envelope(wrongProducer))).toMatchObject({
      ok: false,
      reason: 'required-check-missing-or-stale',
    });

    expect(
      verifyReceipt(envelope(), {
        ...expected,
        requiredChecks: [
          { name: 'CI', appId: 77, checkRunId: 999, checkSuiteId: 201 },
          expected.requiredChecks[1],
        ],
      }),
    ).toMatchObject({ ok: false, reason: 'required-check-missing-or-stale' });

    const duplicate = receipt({
      checks: [receipt().checks[0], receipt().checks[0], receipt().checks[1]],
    });
    expect(verifyReceipt(envelope(duplicate))).toMatchObject({
      ok: false,
      reason: 'duplicate-receipt-checks',
    });
  });

  it('rejects malformed or unsupported data rather than accepting unknown fields', () => {
    expect(verifyReceipt({})).toMatchObject({ ok: false, reason: 'malformed-envelope' });
    const extraField = { ...receipt(), surprise: true };
    expect(verifyReceipt(envelope(extraField as ReviewReceipt))).toMatchObject({
      ok: false,
      reason: 'malformed-receipt',
    });
    expect(verifyReceipt(envelope(), { ...expected, minimumIndependentReviews: 0 })).toMatchObject({
      ok: false,
      reason: 'invalid-expected-context',
    });
  });

  it('rejects duplicate-key and non-canonical JSON transport', () => {
    expect(verifyReceipt('{"keyId":"x","keyId":"x","receipt":{},"signature":"x"}')).toMatchObject({
      ok: false,
      reason: 'malformed-envelope',
    });
    expect(verifyReceipt(JSON.stringify(envelope()))).toMatchObject({
      ok: false,
      reason: 'malformed-envelope',
    });
  });
});
