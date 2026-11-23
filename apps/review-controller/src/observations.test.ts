import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './__tests__/database.js';
import { PostgresWebhookInbox } from './inbox.js';
import { PostgresShadowObservationStore } from './observations.js';
import type { ReviewEvidence } from './reviewer.js';
import type { PullRequestSnapshot } from './snapshot.js';

describe('PostgresShadowObservationStore', () => {
  let db: PGlite;
  let inbox: PostgresWebhookInbox;
  let store: PostgresShadowObservationStore;

  beforeEach(async () => {
    const database = await createTestDatabase();
    db = database.client;
    inbox = new PostgresWebhookInbox(database.db);
    store = new PostgresShadowObservationStore(database.db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('appends exact-candidate evidence once per webhook and preserves separate event records', async () => {
    const pullDelivery = '00000000-0000-4000-8000-000000000010';
    const mergeDelivery = '00000000-0000-4000-8000-000000000011';
    await inbox.enqueue(webhook(pullDelivery));
    await inbox.enqueue(webhook(mergeDelivery));

    const snapshot: PullRequestSnapshot = {
      repositoryId: 123,
      pullRequest: 7,
      state: 'open',
      draft: false,
      baseRef: 'test',
      headSha: 'a'.repeat(40),
      headTreeSha: 'b'.repeat(40),
      baseSha: 'c'.repeat(40),
      baseTreeSha: 'd'.repeat(40),
      manifest: { files: [], fileCount: 0, sha256: 'e'.repeat(64) },
      content: [
        {
          path: 'private.ts',
          side: 'head',
          blobSha: 'f'.repeat(40),
          sha256: '1'.repeat(64),
          text: 'secret source that must not be retained',
        },
      ],
      securityClassification: {
        classifierVersion: 'shared-security-paths-v1',
        sensitivePaths: [],
      },
    };
    const observation = {
      deliveryId: pullDelivery,
      snapshot,
      checkRuns: [],
      reviewEvidence: {
        status: 'observed' as const,
        review: {
          provider: 'codex-subscription' as const,
          reviewerLogin: 'chatgpt-codex-connector[bot]',
          reviewerId: 90210,
          reviewId: 81,
          reviewedHeadSha: snapshot.headSha,
          currentHeadSha: snapshot.headSha,
          state: 'approved' as const,
          action: 'submitted' as const,
          observedAt: '2026-10-06T12:01:00.000Z',
          bodySha256: '2'.repeat(64),
          inlineCommentCount: 0,
          inlineComments: [],
          submittedAt: '2026-10-06T12:01:00.000Z',
          exactHead: true,
          receiptReview: {
            reviewerId: 'github-user:90210',
            system: 'openai-codex-subscription',
            executionId: 'github-review:81',
            revisionSha: snapshot.headSha,
            verdict: 'approve',
            criticalFindings: 0,
            highFindings: 0,
          },
        },
      },
    };
    await store.recordPullRequest(observation);
    await store.recordPullRequest(observation);
    await store.recordMergeGroup({
      deliveryId: mergeDelivery,
      repositoryId: 123,
      headSha: 'f'.repeat(40),
      baseSha: '1'.repeat(40),
      headTreeSha: '2'.repeat(40),
      checkRuns: [],
    });
    const reviewRows = await store.listReviewObservations({
      repositoryId: 123,
      pullRequest: 7,
      headSha: 'a'.repeat(40),
      baseSha: 'c'.repeat(40),
    });
    expect(reviewRows).toHaveLength(1);
    expect(reviewRows[0]?.reviewId).toBe(81);

    const result = await db.query<{
      event_kind: string;
      pull_request: number | null;
      snapshot: { content?: Array<Record<string, unknown>> };
    }>(
      'SELECT event_kind, pull_request, snapshot FROM review_controller_shadow_observations ORDER BY event_kind',
    );
    expect(result.rows).toEqual([
      { event_kind: 'merge_group', pull_request: null, snapshot: expect.any(Object) },
      {
        event_kind: 'pull_request',
        pull_request: 7,
        snapshot: expect.objectContaining({
          content: [
            { path: 'private.ts', side: 'head', blobSha: 'f'.repeat(40), sha256: '1'.repeat(64) },
          ],
        }),
      },
    ]);
    expect(JSON.stringify(result.rows)).not.toContain('secret source');
    expect(JSON.stringify(result.rows)).not.toContain('private reviewer summary');
    expect(JSON.stringify(result.rows)).not.toContain('private finding detail');
  });

  it('retains an old non-approving review behind more than 100 snapshots and a replayed approval', async () => {
    const snapshot: PullRequestSnapshot = {
      repositoryId: 123,
      pullRequest: 7,
      state: 'open',
      draft: false,
      baseRef: 'test',
      headSha: 'a'.repeat(40),
      headTreeSha: 'b'.repeat(40),
      baseSha: 'c'.repeat(40),
      baseTreeSha: 'd'.repeat(40),
      manifest: { files: [], fileCount: 0, sha256: 'e'.repeat(64) },
      content: [],
      securityClassification: {
        classifierVersion: 'shared-security-paths-v1',
        sensitivePaths: [],
      },
    };
    const review = (reviewId: number, verdict: 'approve' | 'request-changes') => ({
      status: 'observed' as const,
      review: {
        provider: 'codex-subscription' as const,
        reviewerLogin: 'chatgpt-codex-connector[bot]',
        reviewerId: 90210,
        reviewId,
        reviewedHeadSha: snapshot.headSha,
        currentHeadSha: snapshot.headSha,
        state: verdict === 'approve' ? ('approved' as const) : ('commented' as const),
        action: 'submitted' as const,
        observedAt: '2026-10-06T12:01:00.000Z',
        bodySha256: '1'.repeat(64),
        inlineCommentCount: 0,
        inlineComments: [],
        submittedAt: '2026-10-06T12:01:00.000Z',
        exactHead: true,
        receiptReview: {
          reviewerId: 'github-user:90210',
          system: 'openai-codex-subscription',
          executionId: `github-review:${reviewId}`,
          revisionSha: snapshot.headSha,
          verdict,
          criticalFindings: 0,
          highFindings: 0,
        },
      },
    });
    const deliveryId = (number: number) =>
      `00000000-0000-4000-8000-${number.toString(16).padStart(12, '0')}`;
    const record = async (
      number: number,
      reviewEvidence?: ReviewEvidence,
      candidateSnapshot = snapshot,
    ) => {
      const id = deliveryId(number);
      await inbox.enqueue(webhook(id));
      await store.recordPullRequest({
        deliveryId: id,
        snapshot: candidateSnapshot,
        checkRuns: [],
        reviewEvidence,
      });
    };

    await record(1, review(81, 'request-changes'));
    for (let number = 2; number <= 112; number++) await record(number);
    await record(113, review(82, 'approve'));
    await record(114, review(83, 'request-changes'), {
      ...snapshot,
      baseSha: 'f'.repeat(40),
    });
    await record(115, review(84, 'request-changes'), {
      ...snapshot,
      headSha: 'f'.repeat(40),
    });

    const observations = await store.listReviewObservations({
      repositoryId: snapshot.repositoryId,
      pullRequest: snapshot.pullRequest,
      headSha: snapshot.headSha,
      baseSha: snapshot.baseSha,
    });
    expect(observations.map((observation) => observation.reviewId)).toEqual([81]);
    expect(observations[0]?.receiptReview?.verdict).toBe('request-changes');

    const trusted = (reviewId: number, verdict: 'approve' | 'request-changes'): ReviewEvidence => {
      const result = review(reviewId, verdict);
      return {
        status: 'observed',
        review: {
          ...result.review,
          provider: 'trusted-reviewer-app',
          reviewerLogin: 'revealui-reviewer[bot]',
          reviewerId: 90211,
          receiptReview: {
            ...result.review.receiptReview,
            reviewerId: 'github-user:90211',
            system: 'openai-api-trusted-reviewer-app',
          },
        },
      };
    };
    const candidate = {
      repositoryId: snapshot.repositoryId,
      pullRequest: snapshot.pullRequest,
      headSha: snapshot.headSha,
      baseSha: snapshot.baseSha,
      trustedReviewer: { login: 'revealui-reviewer[bot]', id: 90211 },
    };
    await record(116, trusted(85, 'approve'));
    expect((await store.listReviewObservations(candidate)).map((item) => item.reviewId)).toEqual([
      85,
    ]);
    await record(117, trusted(86, 'request-changes'));
    expect((await store.listReviewObservations(candidate)).map((item) => item.reviewId)).toEqual([
      86,
    ]);
  });
});

function webhook(deliveryId: string) {
  return {
    deliveryId,
    repositoryId: 123,
    installationId: 456,
    event: 'pull_request',
    payload: {
      repository: { id: 123, full_name: 'RevealUIStudio/revealui' },
      installation: { id: 456 },
    },
    receivedAt: '2026-10-06T12:00:00.000Z',
  };
}
