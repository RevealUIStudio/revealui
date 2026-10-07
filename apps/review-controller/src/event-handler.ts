import { createHash } from 'node:crypto';
import { type GitHubAppClient, GitHubAppError } from './github-app.js';
import type { ClaimedWebhook } from './inbox.js';
import type { ShadowObservationStore } from './observations.js';
import { evaluateReceiptShadow } from './receipt-evaluator.js';
import type { ReceiptPolicy } from './receipt-policy.js';
import { persistReceiptThenPublishCheck } from './receipt-publisher.js';
import type { SignedReceiptStore } from './receipt-store.js';
import type { CodexReviewObservation, ReviewEvidence } from './reviewer.js';
import { fetchPullRequestSnapshot } from './snapshot.js';
import type { WebhookHandler } from './worker.js';

const MAX_PULL_REQUESTS_PER_DELIVERY = 20;

export class ShadowWebhookHandler implements WebhookHandler {
  constructor(
    private readonly client: GitHubAppClient,
    private readonly observations: ShadowObservationStore,
    private readonly receiptPolicy?: ReceiptPolicy,
    private readonly receiptStore?: SignedReceiptStore,
  ) {}

  async process(webhook: ClaimedWebhook): Promise<void> {
    if (webhook.repositoryId !== this.client.repositoryId)
      throw new GitHubAppError('repository_scope_mismatch');
    if (
      webhook.eventName === 'check_run' &&
      this.client.isOwnReceiptCheckRun(record(webhook.payload.check_run))
    )
      return;
    if (webhook.eventName === 'merge_group') {
      await this.observeMergeGroup(webhook);
      return;
    }
    const pullRequests = extractPullRequestNumbers(webhook);
    for (const number of pullRequests) {
      const snapshot = await fetchPullRequestSnapshot(this.client, number);
      const checkRuns = await this.client.listCheckRuns(snapshot.headSha);
      const reviewEvidence = await codexReviewEvidence(
        this.client,
        webhook,
        number,
        snapshot.headSha,
        snapshot.draft,
      );
      const receiptEvaluation = this.receiptPolicy
        ? await evaluateReceiptShadow({
            policy: this.receiptPolicy,
            snapshot,
            checkRuns,
            reviewEvidence: await latestCurrentCodexReview(
              this.observations,
              snapshot,
              reviewEvidence,
            ),
            getFreshMergeCandidate: async (current) => {
              const candidate = await this.client.getFreshMergeCandidate({
                pullNumber: current.pullRequest,
                expectedHeadSha: current.headSha,
                expectedBaseSha: current.baseSha,
              });
              return candidate.treeSha;
            },
          })
        : undefined;
      if (this.receiptPolicy?.mode === 'publish') {
        if (!this.receiptStore) throw new Error('receipt_publisher_store_required');
        const externalId = `pr-${snapshot.repositoryId}-${snapshot.pullRequest}`;
        if (receiptEvaluation?.status === 'eligible') {
          await persistReceiptThenPublishCheck({
            envelope: receiptEvaluation.envelope,
            store: this.receiptStore,
            github: this.client,
          });
        } else {
          await this.client.upsertReceiptCheckRun({
            headSha: snapshot.headSha,
            externalId,
            eligible: false,
          });
        }
      }
      const receiptMetadata = receiptEvaluation
        ? receiptEvaluation.status === 'eligible'
          ? {
              status: receiptEvaluation.status,
              evaluatedAt: receiptEvaluation.evaluatedAt,
              receiptId: receiptEvaluation.receiptId,
              envelopeSha256: receiptEvaluation.envelopeSha256,
            }
          : receiptEvaluation
        : undefined;
      await this.observations.recordPullRequest({
        deliveryId: webhook.deliveryId,
        snapshot,
        checkRuns,
        reviewEvidence,
        ...(receiptMetadata ? { receiptEvaluation: receiptMetadata } : {}),
      });
    }
  }

  private async observeMergeGroup(webhook: ClaimedWebhook): Promise<void> {
    const mergeGroup = record(webhook.payload.merge_group);
    const headSha = sha(mergeGroup.head_sha);
    const baseSha = sha(mergeGroup.base_sha);
    const headTreeSha = await this.client.getCommitTree(headSha);
    const checkRuns = await this.client.listCheckRuns(headSha);
    await this.observations.recordMergeGroup({
      deliveryId: webhook.deliveryId,
      repositoryId: webhook.repositoryId,
      headSha,
      baseSha,
      headTreeSha,
      checkRuns,
    });
  }
}

async function latestCurrentCodexReview(
  observations: ShadowObservationStore,
  snapshot: Awaited<ReturnType<typeof fetchPullRequestSnapshot>>,
  incoming: ReviewEvidence,
): Promise<ReviewEvidence> {
  const reviews = await observations.listReviewObservations({
    repositoryId: snapshot.repositoryId,
    pullRequest: snapshot.pullRequest,
    headSha: snapshot.headSha,
    baseSha: snapshot.baseSha,
  });
  if (incoming.status === 'observed') reviews.push(incoming.review);
  const current = reviews
    .filter(
      (review) =>
        review.reviewedHeadSha === snapshot.headSha &&
        review.currentHeadSha === snapshot.headSha &&
        review.receiptReview?.revisionSha === snapshot.headSha,
    )
    .sort(
      (left, right) =>
        Date.parse(right.observedAt) - Date.parse(left.observedAt) ||
        right.reviewId - left.reviewId,
    )[0];
  return current ? { status: 'observed', review: current } : { status: 'not_observed' };
}

async function codexReviewEvidence(
  client: GitHubAppClient,
  webhook: ClaimedWebhook,
  pullNumber: number,
  currentHeadSha: string,
  draft: boolean,
): Promise<ReviewEvidence> {
  if (webhook.eventName !== 'pull_request_review')
    return isReviewTrigger(webhook) && !draft
      ? { status: 'not_observed' }
      : { status: 'not_requested' };

  const review = record(webhook.payload.review);
  const author = isRecord(review.user) ? review.user : null;
  const action = webhook.payload.action;
  if (
    !(
      author &&
      author.login === 'chatgpt-codex-connector[bot]' &&
      author.type === 'Bot' &&
      Number.isSafeInteger(author.id) &&
      Number(author.id) > 0 &&
      Number.isSafeInteger(review.id) &&
      Number(review.id) > 0 &&
      ['submitted', 'edited', 'dismissed'].includes(String(action)) &&
      typeof review.commit_id === 'string' &&
      /^[a-f0-9]{40,64}$/.test(review.commit_id) &&
      ['COMMENTED', 'APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(String(review.state)) &&
      (review.body === null || typeof review.body === 'string') &&
      !(typeof review.body === 'string' && Buffer.byteLength(review.body, 'utf8') > 64 * 1024)
    )
  )
    return { status: 'not_requested' };

  const reviewedHeadSha = review.commit_id;
  const actionValue = action as CodexReviewObservation['action'];
  const state: CodexReviewObservation['state'] =
    actionValue === 'dismissed' || review.state === 'DISMISSED'
      ? 'dismissed'
      : (String(review.state).toLowerCase() as Exclude<
          CodexReviewObservation['state'],
          'dismissed'
        >);
  const submittedAt =
    typeof review.submitted_at === 'string' && Number.isFinite(Date.parse(review.submitted_at))
      ? new Date(review.submitted_at).toISOString()
      : null;
  const body = typeof review.body === 'string' ? review.body : '';
  const reviewedCurrentHead = reviewedHeadSha === currentHeadSha;
  const exactHead = reviewedCurrentHead && actionValue !== 'dismissed' && state !== 'dismissed';
  const inlineComments = exactHead
    ? await client.listPullRequestReviewComments(pullNumber, Number(review.id), reviewedHeadSha)
    : [];
  if (
    inlineComments.some(
      (comment) =>
        comment.user.login !== 'chatgpt-codex-connector[bot]' || comment.user.type !== 'Bot',
    )
  )
    throw new GitHubAppError('review_comment_author_mismatch');
  const sanitizedComments = inlineComments.map((comment) => ({
    commentId: comment.id,
    path: comment.path,
    line: comment.line,
    severity: /^\s*\[P0\]/i.test(comment.body) ? ('critical' as const) : ('high' as const),
    bodySha256: createHash('sha256').update(comment.body, 'utf8').digest('hex'),
  }));
  const criticalFindings = sanitizedComments.filter(
    (comment) => comment.severity === 'critical',
  ).length;
  const highFindings = sanitizedComments.length - criticalFindings;
  const receiptReview = reviewedCurrentHead
    ? {
        reviewerId: `github-user:${Number(author.id)}`,
        system: 'openai-codex-subscription',
        executionId: `github-review:${Number(review.id)}`,
        revisionSha: reviewedHeadSha,
        verdict:
          state === 'changes_requested' ||
          state === 'dismissed' ||
          actionValue === 'dismissed' ||
          sanitizedComments.length > 0 ||
          state !== 'approved'
            ? ('request-changes' as const)
            : ('approve' as const),
        criticalFindings,
        highFindings,
      }
    : undefined;
  return {
    status: 'observed',
    review: {
      provider: 'codex-subscription',
      reviewerLogin: String(author.login),
      reviewerId: Number(author.id),
      reviewId: Number(review.id),
      reviewedHeadSha,
      currentHeadSha,
      state,
      action: actionValue,
      observedAt: webhook.receivedAt.toISOString(),
      bodySha256: createHash('sha256').update(body, 'utf8').digest('hex'),
      inlineCommentCount: inlineComments.length,
      inlineComments: sanitizedComments,
      submittedAt,
      exactHead,
      ...(receiptReview ? { receiptReview } : {}),
    },
  };
}

function isReviewTrigger(webhook: ClaimedWebhook): boolean {
  if (webhook.eventName !== 'pull_request') return false;
  const action = webhook.payload.action;
  return ['opened', 'synchronize', 'reopened', 'ready_for_review', 'edited'].includes(
    String(action),
  );
}

function extractPullRequestNumbers(webhook: ClaimedWebhook): number[] {
  const payload = webhook.payload;
  let raw: unknown;
  if (webhook.eventName === 'pull_request' || webhook.eventName === 'pull_request_review') {
    raw = record(payload.pull_request).number;
  } else if (webhook.eventName === 'check_run') {
    raw = record(payload.check_run).pull_requests;
  } else if (webhook.eventName === 'check_suite') {
    raw = record(payload.check_suite).pull_requests;
  } else {
    throw new GitHubAppError('unsupported_observation_event');
  }

  if (webhook.eventName === 'pull_request' || webhook.eventName === 'pull_request_review') {
    if (!Number.isSafeInteger(raw) || Number(raw) <= 0)
      throw new GitHubAppError('invalid_pull_request_number');
    return [Number(raw)];
  }
  if (!Array.isArray(raw)) throw new GitHubAppError('invalid_check_pull_requests');
  if (raw.length > MAX_PULL_REQUESTS_PER_DELIVERY)
    throw new GitHubAppError('pull_request_association_limit');
  const numbers = new Set<number>();
  for (const item of raw) {
    const pr = record(item);
    if (!Number.isSafeInteger(pr.number) || Number(pr.number) <= 0)
      throw new GitHubAppError('invalid_pull_request_number');
    numbers.add(Number(pr.number));
  }
  return [...numbers].sort((left, right) => left - right);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new GitHubAppError('invalid_webhook_payload');
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/.test(value))
    throw new GitHubAppError('invalid_merge_group_sha');
  return value;
}
