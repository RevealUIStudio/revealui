import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { GitHubCheckRun } from './github-app.js';
import { signCandidateReceipt } from './receipt-builder.js';
import type { CodexReviewObservation } from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';

const sha = (letter: string) => letter.repeat(40);
const digest = (letter: string) => letter.repeat(64);
const { privateKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const expected = {
  repositoryId: 1234,
  repositoryFullName: 'RevealUIStudio/revealui',
  pullRequest: 3054,
  headSha: sha('a'),
  headTreeSha: sha('b'),
  baseSha: sha('c'),
  baseTreeSha: sha('d'),
  mergeCandidateTreeSha: sha('e'),
  manifestSha256: digest('f'),
  policyVersion: 'policy-1',
  classifierVersion: 'classifier-1',
  requiredChecks: [{ name: 'CI', appId: 77, checkRunId: 101, checkSuiteId: 201 }],
  minimumIndependentReviews: 1,
  maxReceiptLifetimeMs: 6 * 60 * 60 * 1000,
  now: new Date('2026-10-06T13:00:00.000Z'),
} as const;

const snapshot: PullRequestSnapshot = {
  repositoryId: 1234,
  pullRequest: 3054,
  state: 'open',
  draft: false,
  baseRef: 'test',
  headSha: expected.headSha,
  headTreeSha: expected.headTreeSha,
  baseSha: expected.baseSha,
  baseTreeSha: expected.baseTreeSha,
  manifest: { files: [], fileCount: 0, sha256: expected.manifestSha256 },
  content: [],
  securityClassification: { classifierVersion: 'classifier-1', sensitivePaths: [] },
};

const checkRun: GitHubCheckRun = {
  id: 101,
  check_suite: { id: 201 },
  name: 'CI',
  head_sha: expected.headSha,
  status: 'completed',
  conclusion: 'success',
  completed_at: '2026-10-06T12:30:00.000Z',
  app: { id: 77, slug: 'github-actions' },
};

const review = (overrides: Partial<CodexReviewObservation> = {}): CodexReviewObservation => ({
  provider: 'codex-subscription',
  reviewerLogin: 'chatgpt-codex-connector[bot]',
  reviewerId: 900,
  reviewId: 500,
  reviewedHeadSha: expected.headSha,
  currentHeadSha: expected.headSha,
  state: 'commented',
  action: 'submitted',
  observedAt: '2026-10-06T12:20:00.000Z',
  bodySha256: digest('1'),
  inlineCommentCount: 0,
  inlineComments: [],
  submittedAt: '2026-10-06T12:19:00.000Z',
  exactHead: true,
  receiptReview: {
    reviewerId: 'github-user:900',
    system: 'openai-codex-subscription',
    executionId: 'github-review:500',
    revisionSha: expected.headSha,
    verdict: 'approve',
    criticalFindings: 0,
    highFindings: 0,
  },
  ...overrides,
});

function build(
  input: {
    reviews?: readonly CodexReviewObservation[];
    checkRuns?: readonly GitHubCheckRun[];
    currentSnapshot?: PullRequestSnapshot;
    minimumIndependentReviews?: number;
    requiredChecks?: (typeof expected.requiredChecks)[number][];
  } = {},
) {
  return signCandidateReceipt({
    keyId: 'controller-key-1',
    privateKey: privatePem,
    expected: {
      ...expected,
      minimumIndependentReviews: input.minimumIndependentReviews ?? 1,
      requiredChecks: input.requiredChecks ?? expected.requiredChecks,
    },
    snapshot: input.currentSnapshot ?? snapshot,
    mergeCandidateTreeSha: expected.mergeCandidateTreeSha,
    checkRuns: input.checkRuns ?? [checkRun],
    reviews: input.reviews ?? [review()],
  });
}

describe('signCandidateReceipt', () => {
  it('signs deterministic receipts from an exact-head clean review and required check', () => {
    const first = build();
    const repeated = build();
    expect(first).toEqual(repeated);
    expect(first.receipt.decision).toBe('approve');
    expect(first.receipt.reviews).toHaveLength(1);
    expect(first.receipt.checks[0]).toMatchObject({ checkRunId: 101, conclusion: 'success' });
  });

  it('rejects a required check that is stale or incomplete', () => {
    expect(() => build({ checkRuns: [{ ...checkRun, head_sha: sha('9') }] })).toThrow(
      'receipt_required_check_missing_or_stale',
    );
    expect(() => build({ checkRuns: [{ ...checkRun, completed_at: null }] })).toThrow(
      'receipt_required_check_missing_or_stale',
    );
  });

  it('refuses to sign when the trusted policy contains no required checks', () => {
    expect(() =>
      signCandidateReceipt({
        keyId: 'controller-key-1',
        privateKey: privatePem,
        expected: { ...expected, requiredChecks: [] },
        snapshot,
        mergeCandidateTreeSha: expected.mergeCandidateTreeSha,
        checkRuns: [checkRun],
        reviews: [review()],
      }),
    ).toThrow('receipt_required_check_policy_empty');
  });

  it('ignores stale reviews and rejects a current-head dismissal superseding approval', () => {
    expect(() => build({ reviews: [review({ reviewedHeadSha: sha('9') })] })).toThrow(
      'receipt_insufficient_independent_reviews',
    );
    const dismissed = review({
      reviewId: 501,
      action: 'dismissed',
      state: 'dismissed',
      observedAt: '2026-10-06T12:40:00.000Z',
      receiptReview: {
        ...review().receiptReview!,
        executionId: 'github-review:501',
        verdict: 'request-changes',
      },
    });
    expect(() => build({ reviews: [review(), dismissed] })).toThrow();
  });

  it('requires the exact-head security check suite for sensitive paths with one subscription review', () => {
    const sensitiveSnapshot = {
      ...snapshot,
      securityClassification: {
        classifierVersion: 'classifier-1',
        sensitivePaths: ['src/auth.ts'],
      },
    };
    expect(() => build({ currentSnapshot: sensitiveSnapshot })).toThrow(
      'receipt_security_check_policy_incomplete',
    );
    const securitySelectors = [
      { name: 'CodeQL', appId: 57789, checkRunId: 102, checkSuiteId: 202 },
      { name: 'Security Gate', appId: 15368, checkRunId: 103, checkSuiteId: 203 },
      { name: 'Dependency Review', appId: 15368, checkRunId: 104, checkSuiteId: 204 },
      { name: 'Secret Scanning (Gitleaks)', appId: 15368, checkRunId: 105, checkSuiteId: 205 },
    ];
    const securityRuns = securitySelectors.map(
      (selector) =>
        ({
          id: selector.checkRunId,
          check_suite: { id: selector.checkSuiteId },
          name: selector.name,
          head_sha: expected.headSha,
          status: 'completed',
          conclusion: 'success',
          completed_at: '2026-10-06T12:45:00.000Z',
          app: { id: selector.appId, slug: 'github-actions' },
        }) satisfies GitHubCheckRun,
    );
    const signed = build({
      currentSnapshot: sensitiveSnapshot,
      requiredChecks: [...expected.requiredChecks, ...securitySelectors],
      checkRuns: [checkRun, ...securityRuns],
    });
    expect(signed.receipt.reviews).toHaveLength(1);
    expect(signed.receipt.checks).toHaveLength(5);
  });

  it('rejects a review containing findings', () => {
    const withFinding = review({
      inlineCommentCount: 1,
      inlineComments: [
        {
          commentId: 999,
          path: 'src/example.ts',
          line: 10,
          severity: 'high',
          bodySha256: digest('2'),
        },
      ],
      receiptReview: {
        ...review().receiptReview!,
        verdict: 'request-changes',
        highFindings: 1,
      },
    });
    expect(() => build({ reviews: [withFinding] })).toThrow();
  });
});
