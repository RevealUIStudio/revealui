import { createHash } from 'node:crypto';
import {
  type ReviewReceipt,
  type ReviewReceiptContext,
  reviewReceiptCheckEvidenceSha256,
  signReviewReceipt,
} from '@revealui/security/review-receipt';
import { GitHubAppError, type GitHubCheckRun } from './github-app.js';
import type { CodexReviewObservation } from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';

export function signCandidateReceipt(input: {
  keyId: string;
  privateKey: string | Buffer;
  expected: ReviewReceiptContext;
  snapshot: PullRequestSnapshot;
  mergeCandidateTreeSha: string;
  checkRuns: readonly GitHubCheckRun[];
  reviews: readonly CodexReviewObservation[];
}): ReturnType<typeof signReviewReceipt> {
  const { expected, snapshot } = input;
  if (
    snapshot.state !== 'open' ||
    snapshot.draft ||
    snapshot.repositoryId !== expected.repositoryId ||
    snapshot.pullRequest !== expected.pullRequest ||
    snapshot.headSha !== expected.headSha ||
    snapshot.headTreeSha !== expected.headTreeSha ||
    snapshot.baseSha !== expected.baseSha ||
    snapshot.baseTreeSha !== expected.baseTreeSha ||
    snapshot.manifest.sha256 !== expected.manifestSha256 ||
    snapshot.securityClassification.classifierVersion !== expected.classifierVersion ||
    input.mergeCandidateTreeSha !== expected.mergeCandidateTreeSha
  )
    throw new GitHubAppError('receipt_snapshot_context_mismatch');

  const minimumForPaths = snapshot.securityClassification.sensitivePaths.length > 0 ? 2 : 1;
  if (expected.minimumIndependentReviews < minimumForPaths)
    throw new GitHubAppError('receipt_review_threshold_too_weak');
  if (expected.requiredChecks.length === 0)
    throw new GitHubAppError('receipt_required_check_policy_empty');

  const latestReviews = new Map<string, CodexReviewObservation>();
  for (const review of input.reviews) {
    if (
      review.reviewedHeadSha !== expected.headSha ||
      review.currentHeadSha !== expected.headSha ||
      review.receiptReview?.revisionSha !== expected.headSha
    )
      continue;
    const previous = latestReviews.get(String(review.reviewerId));
    if (!Number.isFinite(Date.parse(review.observedAt)))
      throw new GitHubAppError('receipt_review_timestamp_missing');
    if (!previous || Date.parse(review.observedAt) >= Date.parse(previous.observedAt))
      latestReviews.set(String(review.reviewerId), review);
  }
  const currentReviews = [...latestReviews.values()];
  const reviews = currentReviews.map((review) => {
    if (!review.receiptReview) throw new GitHubAppError('receipt_review_missing');
    return review.receiptReview;
  });
  const checks = expected.requiredChecks.map((required) => {
    const run = input.checkRuns.find(
      (candidate) =>
        candidate.name === required.name &&
        candidate.app.id === required.appId &&
        candidate.id === required.checkRunId &&
        candidate.check_suite.id === required.checkSuiteId,
    );
    if (
      !run ||
      run.head_sha !== expected.headSha ||
      run.status !== 'completed' ||
      run.conclusion !== 'success' ||
      !run.completed_at ||
      !Number.isFinite(Date.parse(run.completed_at))
    )
      throw new GitHubAppError('receipt_required_check_missing_or_stale');
    return {
      name: run.name,
      appId: run.app.id,
      checkRunId: run.id,
      checkSuiteId: run.check_suite.id,
      conclusion: 'success' as const,
      evidenceSha256: reviewReceiptCheckEvidenceSha256({
        name: run.name,
        appId: run.app.id,
        checkRunId: run.id,
        checkSuiteId: run.check_suite.id,
        headSha: run.head_sha,
        status: run.status,
        conclusion: run.conclusion,
        completedAt: run.completed_at,
      }),
    };
  });

  if (reviews.length < expected.minimumIndependentReviews)
    throw new GitHubAppError('receipt_insufficient_independent_reviews');
  const evidenceTimes = [
    ...currentReviews.map((review) => review.observedAt),
    ...input.checkRuns
      .filter((run) => expected.requiredChecks.some((check) => check.checkRunId === run.id))
      .map((run) => run.completed_at),
  ];
  if (evidenceTimes.some((time) => !(time && Number.isFinite(Date.parse(time)))))
    throw new GitHubAppError('receipt_evidence_timestamp_missing');
  const validEvidenceTimes = evidenceTimes.filter((time): time is string => Boolean(time));
  const issuedAt = new Date(
    Math.max(...validEvidenceTimes.map((time) => Date.parse(time))),
  ).toISOString();
  const expiresAt = new Date(Date.parse(issuedAt) + expected.maxReceiptLifetimeMs).toISOString();
  const reviewRows = [...reviews].sort((left, right) =>
    left.reviewerId.localeCompare(right.reviewerId),
  );
  const checkRows = [...checks].sort(
    (left, right) => left.name.localeCompare(right.name) || left.appId - right.appId,
  );
  const identityMaterial = JSON.stringify({
    repositoryId: expected.repositoryId,
    pullRequest: expected.pullRequest,
    headSha: expected.headSha,
    baseSha: expected.baseSha,
    mergeCandidateTreeSha: expected.mergeCandidateTreeSha,
    manifestSha256: expected.manifestSha256,
    policyVersion: expected.policyVersion,
    classifierVersion: expected.classifierVersion,
    issuedAt,
    reviews: reviewRows,
    checks: checkRows,
  });
  const receipt: ReviewReceipt = {
    schema: 'revealfleet-review-receipt/v1',
    receiptId: `receipt-${sha256(identityMaterial)}`,
    issuedAt,
    expiresAt,
    repository: { id: snapshot.repositoryId, fullName: expected.repositoryFullName },
    pullRequest: snapshot.pullRequest,
    head: { sha: snapshot.headSha, treeSha: snapshot.headTreeSha },
    base: { sha: snapshot.baseSha, treeSha: snapshot.baseTreeSha },
    mergeCandidate: { treeSha: input.mergeCandidateTreeSha },
    manifest: { sha256: snapshot.manifest.sha256, fileCount: snapshot.manifest.fileCount },
    policy: {
      version: expected.policyVersion,
      classifierVersion: expected.classifierVersion,
    },
    reviews: reviewRows,
    checks: checkRows,
    decision: 'approve',
  };
  return signReviewReceipt({
    keyId: input.keyId,
    receipt,
    privateKey: input.privateKey,
    expected,
  });
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
