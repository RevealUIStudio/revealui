import {
  type ReviewControllerDatabase,
  reviewControllerShadowObservations,
} from '@revealui/db/review-controller';
import { and, desc, eq } from 'drizzle-orm';
import type { GitHubCheckRun } from './github-app.js';
import type { ReceiptEvaluationMetadata } from './receipt-evaluator.js';
import {
  type CodexReviewObservation,
  type ReviewEvidence,
  redactReviewEvidence,
} from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';

export interface ShadowObservationStore {
  listReviewObservations(input: {
    repositoryId: number;
    pullRequest: number;
    headSha: string;
    baseSha: string;
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
  }): Promise<CodexReviewObservation[]> {
    const rows = await this.db
      .select({ snapshot: reviewControllerShadowObservations.snapshot })
      .from(reviewControllerShadowObservations)
      .where(
        and(
          eq(reviewControllerShadowObservations.eventKind, 'pull_request'),
          eq(reviewControllerShadowObservations.repositoryId, input.repositoryId),
          eq(reviewControllerShadowObservations.pullRequest, input.pullRequest),
          eq(reviewControllerShadowObservations.headSha, input.headSha),
          eq(reviewControllerShadowObservations.baseSha, input.baseSha),
        ),
      )
      .orderBy(desc(reviewControllerShadowObservations.observedAt))
      .limit(100);
    return rows.flatMap(({ snapshot }) => {
      const reviewEvidence = snapshot.reviewEvidence;
      if (!isRecord(reviewEvidence) || reviewEvidence.status !== 'observed') return [];
      return isCodexReviewObservation(reviewEvidence.review) ? [reviewEvidence.review] : [];
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
    value.provider === 'codex-subscription' &&
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
