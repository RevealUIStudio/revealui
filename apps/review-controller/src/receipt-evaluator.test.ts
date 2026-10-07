import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { GitHubCheckRun } from './github-app.js';
import { evaluateReceiptShadow } from './receipt-evaluator.js';
import type { ReceiptPolicy } from './receipt-policy.js';
import type { CodexReviewObservation, ReviewEvidence } from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';

const sha = (letter: string) => letter.repeat(40);
const digest = (letter: string) => letter.repeat(64);
const { privateKey } = generateKeyPairSync('ed25519');
const policy: ReceiptPolicy = {
  mode: 'shadow',
  repositoryFullName: 'RevealUIStudio/revealui',
  keyId: 'receipt-key-1',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  version: 'policy-1',
  maxLifetimeMs: 21_600_000,
  requiredChecks: [{ name: 'CI', appId: 77 }],
};
const snapshot: PullRequestSnapshot = {
  repositoryId: 1234,
  pullRequest: 3054,
  state: 'open',
  draft: false,
  baseRef: 'test',
  headSha: sha('a'),
  headTreeSha: sha('b'),
  baseSha: sha('c'),
  baseTreeSha: sha('d'),
  manifest: { files: [], fileCount: 0, sha256: digest('f') },
  content: [],
  securityClassification: { classifierVersion: 'classifier-1', sensitivePaths: [] },
};
const checkRun: GitHubCheckRun = {
  id: 101,
  check_suite: { id: 201 },
  name: 'CI',
  head_sha: snapshot.headSha,
  status: 'completed',
  conclusion: 'success',
  completed_at: '2026-10-06T12:30:00.000Z',
  app: { id: 77, slug: 'github-actions' },
};
const review: CodexReviewObservation = {
  provider: 'codex-subscription',
  reviewerLogin: 'chatgpt-codex-connector[bot]',
  reviewerId: 900,
  reviewId: 500,
  reviewedHeadSha: snapshot.headSha,
  currentHeadSha: snapshot.headSha,
  state: 'approved',
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
    revisionSha: snapshot.headSha,
    verdict: 'approve',
    criticalFindings: 0,
    highFindings: 0,
  },
};

describe('evaluateReceiptShadow', () => {
  const evaluate = (reviewEvidence: ReviewEvidence, checkRuns = [checkRun]) =>
    evaluateReceiptShadow({
      policy,
      snapshot,
      checkRuns,
      reviewEvidence,
      now: new Date('2026-10-06T13:00:00.000Z'),
      getFreshMergeCandidate: vi.fn(async () => sha('e')),
    });

  it('evaluates a fresh receipt candidate into a signed envelope and receipt metadata', async () => {
    const result = await evaluate({ status: 'observed', review });
    expect(result).toMatchObject({
      status: 'eligible',
      receiptId: expect.stringMatching(/^receipt-[a-f0-9]{64}$/),
      envelopeSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(result)).not.toContain('privateKey');
    expect(result).toMatchObject({
      envelope: { keyId: 'receipt-key-1', signature: expect.any(String) },
    });
  });

  it('records ineligibility without fetching merge-candidate state when review evidence is absent', async () => {
    const getFreshMergeCandidate = vi.fn(async () => sha('e'));
    const result = await evaluateReceiptShadow({
      policy,
      snapshot,
      checkRuns: [checkRun],
      reviewEvidence: { status: 'not_observed' },
      getFreshMergeCandidate,
      now: new Date('2026-10-06T13:00:00.000Z'),
    });
    expect(result).toMatchObject({ status: 'ineligible', reason: 'codex_review_not_observed' });
    expect(getFreshMergeCandidate).not.toHaveBeenCalled();
  });

  it('fails closed when a configured check selector is absent or ambiguous', async () => {
    await expect(evaluate({ status: 'observed', review }, [])).resolves.toMatchObject({
      status: 'ineligible',
      reason: 'receipt_required_check_selector_not_unique',
    });
    await expect(
      evaluate({ status: 'observed', review }, [checkRun, { ...checkRun, id: 102 }]),
    ).resolves.toMatchObject({
      status: 'ineligible',
      reason: 'receipt_required_check_selector_not_unique',
    });
  });

  it('does not let one subscription review satisfy sensitive-path policy', async () => {
    await expect(
      evaluateReceiptShadow({
        policy,
        snapshot: {
          ...snapshot,
          securityClassification: {
            classifierVersion: 'classifier-1',
            sensitivePaths: ['src/auth.ts'],
          },
        },
        checkRuns: [checkRun],
        reviewEvidence: { status: 'observed', review },
        getFreshMergeCandidate: async () => sha('e'),
        now: new Date('2026-10-06T13:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      status: 'ineligible',
      reason: 'receipt_insufficient_independent_reviews',
    });
  });
});
