import {
  type ReviewControllerDatabase,
  reviewControllerShadowObservations,
} from '@revealui/db/review-controller';
import { and, desc, eq, sql } from 'drizzle-orm';
import { GitHubAppError, type GitHubCheckRun } from './github-app.js';
import type { ReceiptEvaluationMetadata } from './receipt-evaluator.js';
import {
  type CodexReviewObservation,
  type ReviewEvidence,
  redactReviewEvidence,
} from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';
import { REVIEW_CONTRACT_SHA256 } from './trusted-review-contract.js';

export interface ShadowObservationStore {
  listReviewObservations(input: {
    repositoryId: number;
    pullRequest: number;
    headSha: string;
    baseSha: string;
    manifestSha256?: string;
    trustedReviewer?: { login: string; id: number; policyVersion: string; model: string };
  }): Promise<CodexReviewObservation[]>;
  recordPullRequest(input: {
    deliveryId: string;
    snapshot: PullRequestSnapshot;
    checkRuns: readonly GitHubCheckRun[];
    reviewEvidence?: ReviewEvidence;
    receiptEvaluation?: ReceiptEvaluationMetadata;
  }): Promise<void>;
  recordMergeGroup(input: {
    deliveryId: string;
    repositoryId: number;
    headSha: string;
    baseSha: string;
    headTreeSha: string;
    checkRuns: readonly GitHubCheckRun[];
  }): Promise<void>;
}

/** Append-only shadow observations; these rows are evidence, never authorization. */
export class PostgresShadowObservationStore implements ShadowObservationStore {
  constructor(private readonly db: ReviewControllerDatabase) {}

  async listReviewObservations(input: {
    repositoryId: number;
    pullRequest: number;
    headSha: string;
    baseSha: string;
    manifestSha256?: string;
    trustedReviewer?: { login: string; id: number; policyVersion: string; model: string };
  }): Promise<CodexReviewObservation[]> {
    const provider = input.trustedReviewer ? 'trusted-reviewer-app' : 'codex-subscription';
    const reviewerLogin = input.trustedReviewer?.login ?? 'chatgpt-codex-connector[bot]';
    const candidate = and(
      eq(reviewControllerShadowObservations.eventKind, 'pull_request'),
      eq(reviewControllerShadowObservations.repositoryId, input.repositoryId),
      eq(reviewControllerShadowObservations.pullRequest, input.pullRequest),
      eq(reviewControllerShadowObservations.headSha, input.headSha),
      eq(reviewControllerShadowObservations.baseSha, input.baseSha),
      sql`${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,status}' = 'observed'`,
      sql`${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,reviewedHeadSha}' = ${input.headSha}`,
      sql`${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,currentHeadSha}' = ${input.headSha}`,
      sql`${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,provider}' = ${provider}`,
      sql`${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,reviewerLogin}' = ${reviewerLogin}`,
      ...(input.trustedReviewer
        ? [
            sql`${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,reviewerId}' = ${String(input.trustedReviewer.id)}`,
            // Legacy or differently bound approvals are ineligible; denials remain absorbing.
            sql`(
              ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,receiptReview,verdict}' IS DISTINCT FROM 'approve'
              OR (
                ${reviewControllerShadowObservations.manifestSha256} = ${input.manifestSha256 ?? ''}
                AND ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,trustedReviewBinding,version}' = '2'
                AND ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,trustedReviewBinding,reviewContractSha256}' = ${REVIEW_CONTRACT_SHA256}
                AND ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,trustedReviewBinding,policyVersion}' = ${input.trustedReviewer.policyVersion}
                AND ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,trustedReviewBinding,model}' = ${input.trustedReviewer.model}
              )
            )`,
          ]
        : []),
    );
    // One database snapshot selects a same-head denial before any approval.
    // Later check snapshots and replayed approvals cannot evict the denial.
    const rows = await this.db
      .select({ snapshot: reviewControllerShadowObservations.snapshot })
      .from(reviewControllerShadowObservations)
      .where(candidate)
      .orderBy(
        sql`CASE WHEN ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,receiptReview,verdict}' = 'approve' AND ${reviewControllerShadowObservations.snapshot} #>> '{reviewEvidence,review,receiptReview,revisionSha}' = ${input.headSha} THEN 1 ELSE 0 END`,
        desc(reviewControllerShadowObservations.observedAt),
      )
      .limit(1);
    return rows.map(({ snapshot }) => {
      const reviewEvidence = snapshot.reviewEvidence;
      if (!(isRecord(reviewEvidence) && isCodexReviewObservation(reviewEvidence.review)))
        throw new GitHubAppError('invalid_stored_review_observation');
      return reviewEvidence.review;
    });
  }

  async recordPullRequest(input: {
    deliveryId: string;
    snapshot: PullRequestSnapshot;
    checkRuns: readonly GitHubCheckRun[];
    reviewEvidence?: ReviewEvidence;
    receiptEvaluation?: ReceiptEvaluationMetadata;
  }): Promise<void> {
    const { snapshot } = input;
    const { content, ...snapshotEvidence } = snapshot;
    const persistedSnapshot = {
      ...snapshotEvidence,
      reviewEvidence: redactReviewEvidence(input.reviewEvidence ?? { status: 'not_observed' }),
      ...(input.receiptEvaluation ? { receiptEvaluation: input.receiptEvaluation } : {}),
      content: content.map(({ path, side, blobSha, sha256 }) => ({ path, side, blobSha, sha256 })),
    };
    await this.db
      .insert(reviewControllerShadowObservations)
      .values({
        deliveryId: input.deliveryId,
        eventKind: 'pull_request',
        repositoryId: snapshot.repositoryId,
        pullRequest: snapshot.pullRequest,
        headSha: snapshot.headSha,
        headTreeSha: snapshot.headTreeSha,
        baseSha: snapshot.baseSha,
        baseTreeSha: snapshot.baseTreeSha,
        manifestSha256: snapshot.manifest.sha256,
        fileCount: snapshot.manifest.fileCount,
        checkRuns: [...input.checkRuns],
        snapshot: persistedSnapshot,
      })
      .onConflictDoNothing();
  }

  async recordMergeGroup(input: {
    deliveryId: string;
    repositoryId: number;
    headSha: string;
    baseSha: string;
    headTreeSha: string;
    checkRuns: readonly GitHubCheckRun[];
  }): Promise<void> {
    await this.db
      .insert(reviewControllerShadowObservations)
      .values({
        deliveryId: input.deliveryId,
        eventKind: 'merge_group',
        repositoryId: input.repositoryId,
        pullRequest: null,
        headSha: input.headSha,
        headTreeSha: input.headTreeSha,
        baseSha: input.baseSha,
        baseTreeSha: null,
        manifestSha256: null,
        fileCount: null,
        checkRuns: [...input.checkRuns],
        snapshot: {
          headSha: input.headSha,
          baseSha: input.baseSha,
          headTreeSha: input.headTreeSha,
        },
      })
      .onConflictDoNothing();
  }
}

function isCodexReviewObservation(value: unknown): value is CodexReviewObservation {
  return (
    isRecord(value) &&
    (value.provider === 'codex-subscription' || value.provider === 'trusted-reviewer-app') &&
    Number.isSafeInteger(value.reviewerId) &&
    Number.isSafeInteger(value.reviewId) &&
    typeof value.reviewedHeadSha === 'string' &&
    typeof value.currentHeadSha === 'string' &&
    typeof value.observedAt === 'string' &&
    Number.isFinite(Date.parse(value.observedAt)) &&
    typeof value.exactHead === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
