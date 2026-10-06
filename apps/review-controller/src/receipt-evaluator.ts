import { createHash } from 'node:crypto';
import type { ReviewReceiptContext } from '@revealui/harnesses/gates';
import { GitHubAppError, type GitHubCheckRun } from './github-app.js';
import { signCandidateReceipt } from './receipt-builder.js';
import type { ReceiptPolicy } from './receipt-policy.js';
import type { ReviewEvidence } from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';

export type ReceiptEvaluation =
  | { status: 'ineligible'; evaluatedAt: string; reason: string }
  | {
      status: 'eligible';
      evaluatedAt: string;
      receiptId: string;
      envelopeSha256: string;
    };

export async function evaluateReceiptShadow(input: {
  policy: ReceiptPolicy;
  snapshot: PullRequestSnapshot;
  checkRuns: readonly GitHubCheckRun[];
  reviewEvidence: ReviewEvidence;
  getFreshMergeCandidate: (snapshot: PullRequestSnapshot) => Promise<string>;
  now?: Date;
}): Promise<ReceiptEvaluation> {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('invalid receipt evaluation clock');
  const ineligible = (reason: string): ReceiptEvaluation => ({
    status: 'ineligible',
    evaluatedAt: now.toISOString(),
    reason,
  });
  if (input.reviewEvidence.status !== 'observed') return ineligible('codex_review_not_observed');
  const review = input.reviewEvidence.review;
  if (review.receiptReview?.verdict !== 'approve') return ineligible('codex_review_not_approving');

  const requiredChecks: ReviewReceiptContext['requiredChecks'][number][] = [];
  for (const selector of input.policy.requiredChecks) {
    const matches = input.checkRuns.filter(
      (run) => run.name === selector.name && run.app.id === selector.appId,
    );
    if (matches.length !== 1) return ineligible('receipt_required_check_selector_not_unique');
    const [run] = matches;
    if (!run) return ineligible('receipt_required_check_selector_not_unique');
    requiredChecks.push({
      name: selector.name,
      appId: selector.appId,
      checkRunId: run.id,
      checkSuiteId: run.check_suite.id,
    });
  }
  let mergeCandidateTreeSha: string;
  try {
    mergeCandidateTreeSha = await input.getFreshMergeCandidate(input.snapshot);
  } catch (error) {
    if (
      error instanceof GitHubAppError &&
      ['merge_candidate_pull_request_changed', 'merge_candidate_unavailable'].includes(error.code)
    )
      return ineligible(error.code);
    throw error;
  }
  const expected: ReviewReceiptContext = {
    repositoryId: input.snapshot.repositoryId,
    repositoryFullName: input.policy.repositoryFullName,
    pullRequest: input.snapshot.pullRequest,
    headSha: input.snapshot.headSha,
    headTreeSha: input.snapshot.headTreeSha,
    baseSha: input.snapshot.baseSha,
    baseTreeSha: input.snapshot.baseTreeSha,
    mergeCandidateTreeSha,
    manifestSha256: input.snapshot.manifest.sha256,
    policyVersion: input.policy.version,
    classifierVersion: input.snapshot.securityClassification.classifierVersion,
    requiredChecks,
    minimumIndependentReviews:
      input.snapshot.securityClassification.sensitivePaths.length > 0 ? 2 : 1,
    maxReceiptLifetimeMs: input.policy.maxLifetimeMs,
    now,
  };
  try {
    const envelope = signCandidateReceipt({
      keyId: input.policy.keyId,
      privateKey: input.policy.privateKey,
      expected,
      snapshot: input.snapshot,
      mergeCandidateTreeSha,
      checkRuns: input.checkRuns,
      reviews: [review],
    });
    const envelopeSha256 = createHash('sha256')
      .update(JSON.stringify(envelope), 'utf8')
      .digest('hex');
    return {
      status: 'eligible',
      evaluatedAt: now.toISOString(),
      receiptId: envelope.receipt.receiptId,
      envelopeSha256,
    };
  } catch (error) {
    if (error instanceof GitHubAppError && error.code.startsWith('receipt_'))
      return ineligible(error.code);
    throw error;
  }
}
