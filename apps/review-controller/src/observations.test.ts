import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresWebhookInbox } from './inbox.js';
import { PostgresShadowObservationStore } from './observations.js';
import type { PullRequestSnapshot } from './snapshot.js';

describe('PostgresShadowObservationStore', () => {
  let db: PGlite;
  let inbox: PostgresWebhookInbox;
  let store: PostgresShadowObservationStore;

  beforeEach(async () => {
    db = new PGlite();
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0001_webhook_inbox.sql'),
      'utf8',
    );
    await db.exec(migration);
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        const result = await db.query(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows ?? null };
      },
    } as unknown as Pool;
    inbox = new PostgresWebhookInbox(pool);
    store = new PostgresShadowObservationStore(pool);
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
          reviewedHeadSha: 'f'.repeat(40),
          currentHeadSha: 'f'.repeat(40),
          state: 'commented' as const,
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
            revisionSha: 'f'.repeat(40),
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
