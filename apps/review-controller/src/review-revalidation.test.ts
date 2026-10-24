import { createHash, generateKeyPairSync } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase } from './__tests__/database.js';
import { createTestPublicationCoordinator } from './__tests__/publication-coordinator.js';
import { ShadowWebhookHandler } from './event-handler.js';
import type { GitHubAppClient, GitHubCheckRun } from './github-app.js';
import { type ClaimedWebhook, PostgresWebhookInbox } from './inbox.js';
import { PostgresShadowObservationStore } from './observations.js';
import { PostgresReceiptAuthority } from './receipt-authority.js';
import type { ReceiptPolicy } from './receipt-policy.js';
import { PostgresSignedReceiptStore } from './receipt-store.js';
import type { CodexReviewObservation } from './reviewer.js';
import { fetchPullRequestSnapshot } from './snapshot.js';
import { trustedReviewBinding } from './trusted-review-binding.js';

const headSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const reviewer = {
  id: 90211,
  login: 'revealui-reviewer[bot]',
  policyVersion: 'review-policy-1',
  model: 'fixture-model',
};

describe('controller review revalidation with durable observations', () => {
  let database: PGlite;
  let inbox: PostgresWebhookInbox;
  let observations: PostgresShadowObservationStore;
  let receipts: PostgresSignedReceiptStore;
  let authority: PostgresReceiptAuthority;
  let client: GitHubAppClient;
  let policy: ReceiptPolicy;
  let original: CodexReviewObservation;
  let live: Awaited<ReturnType<GitHubAppClient['listPullRequestReviews']>>;
  let sequence: number;

  beforeEach(async () => {
    const store = await createTestDatabase();
    database = store.client;
    inbox = new PostgresWebhookInbox(store.db);
    observations = new PostgresShadowObservationStore(store.db);
    receipts = new PostgresSignedReceiptStore(store.db);
    authority = new PostgresReceiptAuthority(store.db);
    sequence = 0;
    const now = new Date();
    const check: GitHubCheckRun = {
      id: 101,
      check_suite: { id: 201 },
      name: 'Fixture CI',
      head_sha: headSha,
      status: 'completed',
      conclusion: 'success',
      completed_at: now.toISOString(),
      app: { id: 77, slug: 'fixture-ci' },
    };
    client = {
      repositoryId: 300,
      getPullRequest: vi.fn(async () => ({
        number: 7,
        state: 'open',
        draft: false,
        head: { sha: headSha },
        base: { sha: baseSha, ref: 'test' },
      })),
      getCommitTree: vi.fn(async (sha: string) =>
        sha === headSha ? 'c'.repeat(40) : 'd'.repeat(40),
      ),
      getTree: vi.fn(async () => []),
      listPullRequestFiles: vi.fn(async () => []),
      listCheckRuns: vi.fn(async () => [check]),
      listWorkflowRuns: vi.fn(async () => []),
      listPullRequestReviews: vi.fn(async () => live),
      listPullRequestReviewComments: vi.fn(async () => []),
      getFreshMergeCandidate: vi.fn(async () => ({ treeSha: 'e'.repeat(40) })),
      upsertReceiptCheckRun: vi.fn(
        async (input: { headSha: string; externalId: string; eligible: boolean }) => ({
          id: 800,
          name: 'RevealUI Receipt' as const,
          head_sha: input.headSha,
          status: 'completed' as const,
          conclusion: input.eligible ? ('success' as const) : ('failure' as const),
          external_id: input.externalId,
        }),
      ),
    } as unknown as GitHubAppClient;
    const snapshot = await fetchPullRequestSnapshot(client, 7);
    const body = JSON.stringify({
      binding: trustedReviewBinding(snapshot, reviewer.policyVersion, reviewer.model),
      summary: 'No blocking findings.',
      findings: [],
    });
    live = [
      {
        id: 83,
        commit_id: headSha,
        state: 'APPROVED',
        body,
        user: { id: reviewer.id, login: reviewer.login, type: 'Bot' },
      },
    ];
    original = {
      provider: 'trusted-reviewer-app',
      reviewerLogin: reviewer.login,
      reviewerId: reviewer.id,
      reviewId: 83,
      reviewedHeadSha: headSha,
      currentHeadSha: headSha,
      state: 'approved',
      action: 'submitted',
      observedAt: now.toISOString(),
      bodySha256: createHash('sha256').update(body).digest('hex'),
      inlineCommentCount: 0,
      inlineComments: [],
      submittedAt: now.toISOString(),
      exactHead: true,
      receiptReview: {
        reviewerId: `github-user:${reviewer.id}`,
        system: 'openai-api-trusted-reviewer-app',
        executionId: 'github-review:83',
        revisionSha: headSha,
        verdict: 'approve',
        criticalFindings: 0,
        highFindings: 0,
      },
    };
    const { privateKey } = generateKeyPairSync('ed25519');
    policy = {
      mode: 'shadow',
      publicationScope: {
        repositoryId: 300,
        repositoryFullName: 'Fixture/nonproduction',
        pullRequests: [7],
      },
      repositoryFullName: 'Fixture/nonproduction',
      keyId: 'test-key',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      version: 'fixture-policy',
      maxLifetimeMs: 3_600_000,
      requiredChecks: [{ name: check.name, appId: check.app.id }],
      trustedReviewer: reviewer,
    };
    const seed = await delivery();
    await observations.recordPullRequest({
      deliveryId: seed.deliveryId,
      snapshot,
      checkRuns: [check],
      reviewEvidence: { status: 'observed', review: original },
    });
  });

  afterEach(async () => {
    await database?.close();
  });

  async function delivery(): Promise<ClaimedWebhook> {
    sequence += 1;
    const webhook: ClaimedWebhook = {
      deliveryId: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
      eventName: 'pull_request',
      installationId: 200,
      repositoryId: 300,
      receivedAt: new Date(),
      payload: { action: 'synchronize', pull_request: { number: 7 } },
      attempts: 1,
      leaseToken: '11111111-1111-4111-8111-111111111111',
    };
    await inbox.enqueue({
      deliveryId: webhook.deliveryId,
      event: webhook.eventName,
      installationId: webhook.installationId,
      repositoryId: webhook.repositoryId,
      receivedAt: webhook.receivedAt.toISOString(),
      payload: webhook.payload,
    });
    return webhook;
  }

  async function latestReview(): Promise<CodexReviewObservation | undefined> {
    const reviews = await observations.listReviewObservations({
      repositoryId: 300,
      pullRequest: 7,
      headSha,
      baseSha,
      trustedReviewer: reviewer,
    });
    return reviews[0];
  }

  const coordinator = createTestPublicationCoordinator();

  function handler(mode: ReceiptPolicy['mode'] = 'shadow'): ShadowWebhookHandler {
    return new ShadowWebhookHandler(
      client,
      observations,
      { ...policy, mode },
      receipts,
      inbox,
      coordinator,
      authority,
    );
  }

  it('persists a newly discovered denial after the same delivery already stored approval', async () => {
    const webhook = await delivery();
    const approved = live;
    vi.mocked(client.upsertReceiptCheckRun).mockRejectedValueOnce(new Error('check unavailable'));
    await expect(handler('publish').process(webhook)).rejects.toThrow('check unavailable');
    live = [];
    await handler('publish').process(webhook);
    expect((await latestReview())?.receiptReview?.verdict).toBe('request-changes');
    live = approved;
    await handler('publish').process(webhook);
    expect(client.upsertReceiptCheckRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ eligible: false }),
    );
  });

  it('serializes a paused approval worker and later denial so failure is the final check', async () => {
    let release = () => {};
    let entered = () => {};
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.mocked(client.getFreshMergeCandidate).mockImplementationOnce(async () => {
      entered();
      await paused;
      return { treeSha: 'e'.repeat(40) };
    });
    const first = handler('publish').process(await delivery());
    await reached;
    live = [];
    const second = handler('publish').process(await delivery());
    release();
    await Promise.all([first, second]);
    expect((await latestReview())?.receiptReview?.verdict).toBe('request-changes');
    expect(client.upsertReceiptCheckRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ eligible: false }),
    );
  });

  it('keeps a current clean approval eligible without renewing its observed time', async () => {
    await handler('publish').process(await delivery());
    expect(client.upsertReceiptCheckRun).toHaveBeenCalledWith(
      expect.objectContaining({ eligible: true }),
    );
    expect((await latestReview())?.observedAt).toBe(original.observedAt);
    expect(await receipts.listLatest(300)).toHaveLength(1);
  });

  it.each(['deleted', 'dismissed', 'edited'] as const)(
    'persists a %s review denial across a new handler and a replayed native approval',
    async (change) => {
      const approved = structuredClone(live);
      if (change === 'deleted') live = [];
      if (change === 'dismissed') live = live.map((review) => ({ ...review, state: 'DISMISSED' }));
      if (change === 'edited')
        live = live.map((review) => ({ ...review, body: `${review.body} ` }));
      await handler().process(await delivery());
      expect((await latestReview())?.receiptReview?.verdict).toBe('request-changes');
      live = approved;
      await handler('publish').process(await delivery());
      expect(client.upsertReceiptCheckRun).toHaveBeenCalledWith(
        expect.objectContaining({ eligible: false }),
      );
      expect(await receipts.listLatest(300)).toHaveLength(0);
    },
  );

  it('persists revocation before a failed check update and retains it on retry', async () => {
    live = [];
    vi.mocked(client.upsertReceiptCheckRun).mockRejectedValueOnce(new Error('check unavailable'));
    const webhook = await delivery();
    await expect(handler('publish').process(webhook)).rejects.toThrow('check unavailable');
    expect((await latestReview())?.receiptReview?.verdict).toBe('request-changes');
    await handler('publish').process(webhook);
    expect(client.upsertReceiptCheckRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ eligible: false }),
    );
    expect(await receipts.listLatest(300)).toHaveLength(0);
  });

  it('does not mutate external checks when observation storage is unavailable', async () => {
    live = [];
    vi.spyOn(observations, 'recordPullRequest').mockRejectedValueOnce(
      new Error('store unavailable'),
    );
    await expect(handler('publish').process(await delivery())).rejects.toThrow('store unavailable');
    expect(client.upsertReceiptCheckRun).not.toHaveBeenCalled();
  });

  it('does not publish or append a receipt when the reviewer provider is unavailable', async () => {
    vi.mocked(client.listPullRequestReviews).mockRejectedValueOnce(
      new Error('provider unavailable'),
    );
    await expect(handler('publish').process(await delivery())).rejects.toThrow(
      'provider unavailable',
    );
    expect(client.upsertReceiptCheckRun).not.toHaveBeenCalled();
    expect(await receipts.listLatest(300)).toHaveLength(0);
  });
});
