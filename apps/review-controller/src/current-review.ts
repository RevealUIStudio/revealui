import { createHash } from 'node:crypto';
import type { GitHubAppClient } from './github-app.js';
import type { ReceiptPolicy } from './receipt-policy.js';
import type { ReviewEvidence } from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';
import { matchesTrustedReviewBinding } from './trusted-review-binding.js';

/** Stored observations wake evaluation; only a still-current native review can approve. */
export async function revalidateCurrentReview(input: {
  github: Pick<GitHubAppClient, 'listPullRequestReviews' | 'listPullRequestReviewComments'>;
  snapshot: PullRequestSnapshot;
  evidence: ReviewEvidence;
  trustedReviewer: NonNullable<ReceiptPolicy['trustedReviewer']>;
}): Promise<ReviewEvidence> {
  const { evidence, snapshot, trustedReviewer } = input;
  if (evidence.status !== 'observed' || evidence.review.receiptReview?.verdict !== 'approve')
    return evidence;
  const observed = evidence.review;
  const deny = (): ReviewEvidence => ({
    status: 'observed',
    review: {
      ...observed,
      receiptReview: observed.receiptReview
        ? { ...observed.receiptReview, verdict: 'request-changes' }
        : undefined,
    },
  });
  if (
    observed.provider !== 'trusted-reviewer-app' ||
    observed.reviewerId !== trustedReviewer.id ||
    observed.reviewerLogin !== trustedReviewer.login ||
    observed.reviewedHeadSha !== snapshot.headSha ||
    observed.currentHeadSha !== snapshot.headSha
  )
    return deny();
  // Do not convert provider failures into approval or refresh observation time.
  const currentReviews = (await input.github.listPullRequestReviews(snapshot.pullRequest)).filter(
    (review) =>
      review.user.id === trustedReviewer.id &&
      review.user.login === trustedReviewer.login &&
      review.user.type === 'Bot' &&
      review.commit_id === snapshot.headSha,
  );
  if (currentReviews.some((review) => review.state !== 'APPROVED')) return deny();
  const matches = currentReviews.filter((review) => review.id === observed.reviewId);
  if (matches.length !== 1) return deny();
  const current = matches[0];
  if (
    !current ||
    createHash('sha256').update(current.body, 'utf8').digest('hex') !== observed.bodySha256 ||
    !matchesTrustedReviewBinding(
      current.body,
      snapshot,
      trustedReviewer.policyVersion,
      trustedReviewer.model,
    )
  )
    return deny();
  const binding: unknown = JSON.parse(current.body);
  if (
    typeof binding !== 'object' ||
    binding === null ||
    !('findings' in binding) ||
    !Array.isArray(binding.findings) ||
    binding.findings.length !== 0
  )
    return deny();
  const comments = await input.github.listPullRequestReviewComments(
    snapshot.pullRequest,
    observed.reviewId,
    snapshot.headSha,
  );
  if (comments.length !== 0) return deny();
  return evidence;
}
