import type { Pool } from 'pg';
import type { GitHubCheckRun } from './github-app.js';
import type { ReceiptEvaluation } from './receipt-evaluator.js';
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
    receiptEvaluation?: ReceiptEvaluation;
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
  constructor(private readonly pool: Pool) {}

  async listReviewObservations(input: {
    repositoryId: number;
    pullRequest: number;
    headSha: string;
    baseSha: string;
  }): Promise<CodexReviewObservation[]> {
    const result = await this.pool.query<{ review_evidence: unknown }>(
      `SELECT snapshot->'reviewEvidence' AS review_evidence
       FROM review_controller_shadow_observations
       WHERE event_kind = 'pull_request' AND repository_id = $1 AND pull_request = $2
         AND head_sha = $3 AND base_sha = $4
       ORDER BY observed_at DESC
       LIMIT 100`,
      [input.repositoryId, input.pullRequest, input.headSha, input.baseSha],
    );
    return result.rows.flatMap(({ review_evidence }) => {
      if (!isRecord(review_evidence) || review_evidence.status !== 'observed') return [];
      const review = review_evidence.review;
      return isCodexReviewObservation(review) ? [review] : [];
    });
  }

  async recordPullRequest(input: {
    deliveryId: string;
    snapshot: PullRequestSnapshot;
    checkRuns: readonly GitHubCheckRun[];
    reviewEvidence?: ReviewEvidence;
    receiptEvaluation?: ReceiptEvaluation;
  }): Promise<void> {
    const { snapshot } = input;
    const { content, ...snapshotEvidence } = snapshot;
    const persistedSnapshot = {
      ...snapshotEvidence,
      reviewEvidence: redactReviewEvidence(input.reviewEvidence ?? { status: 'not_observed' }),
      ...(input.receiptEvaluation ? { receiptEvaluation: input.receiptEvaluation } : {}),
      content: content.map(({ path, side, blobSha, sha256 }) => ({
        path,
        side,
        blobSha,
        sha256,
      })),
    };
    await this.pool.query(
      `INSERT INTO review_controller_shadow_observations
        (delivery_id, event_kind, repository_id, pull_request, head_sha, head_tree_sha,
         base_sha, base_tree_sha, manifest_sha256, file_count, check_runs, snapshot)
       VALUES ($1, 'pull_request', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        input.deliveryId,
        snapshot.repositoryId,
        snapshot.pullRequest,
        snapshot.headSha,
        snapshot.headTreeSha,
        snapshot.baseSha,
        snapshot.baseTreeSha,
        snapshot.manifest.sha256,
        snapshot.manifest.fileCount,
        JSON.stringify(input.checkRuns),
        JSON.stringify(persistedSnapshot),
      ],
    );
  }

  async recordMergeGroup(input: {
    deliveryId: string;
    repositoryId: number;
    headSha: string;
    baseSha: string;
    headTreeSha: string;
    checkRuns: readonly GitHubCheckRun[];
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO review_controller_shadow_observations
        (delivery_id, event_kind, repository_id, head_sha, head_tree_sha, base_sha,
         check_runs, snapshot)
       VALUES ($1, 'merge_group', $2, $3, $4, $5, $6::jsonb, $7::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        input.deliveryId,
        input.repositoryId,
        input.headSha,
        input.headTreeSha,
        input.baseSha,
        JSON.stringify(input.checkRuns),
        JSON.stringify({
          headSha: input.headSha,
          baseSha: input.baseSha,
          headTreeSha: input.headTreeSha,
        }),
      ],
    );
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
