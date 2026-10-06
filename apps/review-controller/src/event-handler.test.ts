import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ShadowWebhookHandler } from './event-handler.js';
import type { GitHubAppClient, GitHubCheckRun } from './github-app.js';
import type { ClaimedWebhook } from './inbox.js';
import type { ShadowObservationStore } from './observations.js';
import type { ReceiptPolicy } from './receipt-policy.js';

function webhook(eventName: string, payload: Record<string, unknown>): ClaimedWebhook {
  return {
    deliveryId: '00000000-0000-4000-8000-000000000001',
    eventName,
    installationId: 200,
    repositoryId: 300,
    receivedAt: new Date('2026-10-06T12:00:00.000Z'),
    payload,
    attempts: 1,
    leaseToken: '11111111-1111-4111-8111-111111111111',
  };
}

function fixtures() {
  const client = {
    repositoryId: 300,
    getPullRequest: vi.fn(async () => ({
      number: 7,
      state: 'open',
      draft: false,
      head: { sha: 'a'.repeat(40) },
      base: { sha: 'b'.repeat(40), ref: 'test' },
    })),
    getCommitTree: vi.fn(async (sha: string) =>
      sha === 'a'.repeat(40) ? 'c'.repeat(40) : 'd'.repeat(40),
    ),
    getTree: vi.fn(async () => []),
    listPullRequestFiles: vi.fn(async () => []),
    listCheckRuns: vi.fn(async () => []),
    getFreshMergeCandidate: vi.fn(async () => ({
      mergeCommitSha: 'e'.repeat(40),
      treeSha: 'f'.repeat(40),
    })),
    listPullRequestReviewComments: vi.fn(async () => []),
  } as unknown as GitHubAppClient;
  const observations: ShadowObservationStore = {
    listReviewObservations: vi.fn(async () => []),
    recordPullRequest: vi.fn(async () => undefined),
    recordMergeGroup: vi.fn(async () => undefined),
  };
  return { client, observations, handler: new ShadowWebhookHandler(client, observations) };
}

describe('shadow webhook event handler', () => {
  it('fetches fresh PR, file, tree, and check evidence before appending a shadow observation', async () => {
    const { client, observations, handler } = fixtures();
    await handler.process(
      webhook('pull_request', {
        pull_request: { number: 7 },
      }),
    );
    expect(client.getPullRequest).toHaveBeenCalledWith(7);
    expect(client.listCheckRuns).toHaveBeenCalledWith('a'.repeat(40));
    expect(observations.recordPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: '00000000-0000-4000-8000-000000000001',
        snapshot: expect.objectContaining({ pullRequest: 7, headSha: 'a'.repeat(40) }),
      }),
    );
  });

  it('stores the merge-group candidate tree and check observations', async () => {
    const { client, observations, handler } = fixtures();
    await handler.process(
      webhook('merge_group', {
        merge_group: { head_sha: 'a'.repeat(40), base_sha: 'b'.repeat(40) },
      }),
    );
    expect(observations.recordMergeGroup).toHaveBeenCalledWith({
      deliveryId: '00000000-0000-4000-8000-000000000001',
      repositoryId: 300,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      headTreeSha: 'c'.repeat(40),
      checkRuns: [],
    });
    expect(client.listCheckRuns).toHaveBeenCalledWith('a'.repeat(40));
  });

  it('records that model evidence is not configured for review-triggering PR changes', async () => {
    const { client, observations } = fixtures();
    const handler = new ShadowWebhookHandler(client, observations);
    await handler.process(
      webhook('pull_request', {
        action: 'synchronize',
        pull_request: { number: 7 },
      }),
    );
    expect(observations.recordPullRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewEvidence: expect.objectContaining({
          status: 'not_observed',
        }),
      }),
    );
  });

  it('records a dry-run eligibility digest without persisting a receipt envelope', async () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const policy: ReceiptPolicy = {
      repositoryFullName: 'RevealUIStudio/revealui',
      keyId: 'receipt-key-1',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      version: 'policy-1',
      maxLifetimeMs: 21_600_000,
      requiredChecks: [{ name: 'CI', appId: 77 }],
    };
    const { client, observations } = fixtures();
    vi.mocked(client.listCheckRuns).mockResolvedValue([
      {
        id: 101,
        check_suite: { id: 201 },
        name: 'CI',
        head_sha: 'a'.repeat(40),
        status: 'completed',
        conclusion: 'success',
        completed_at: new Date(Date.now() - 60_000).toISOString(),
        app: { id: 77, slug: 'github-actions' },
      } satisfies GitHubCheckRun,
    ]);
    const handler = new ShadowWebhookHandler(client, observations, policy);
    const reviewWebhook = webhook('pull_request_review', {
      action: 'submitted',
      pull_request: { number: 7 },
      review: {
        id: 85,
        user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
        commit_id: 'a'.repeat(40),
        state: 'APPROVED',
        body: 'Approved.',
        submitted_at: '2026-10-06T11:58:00Z',
      },
    });
    reviewWebhook.receivedAt = new Date();
    await handler.process(reviewWebhook);
    expect(client.getFreshMergeCandidate).toHaveBeenCalledWith({
      pullNumber: 7,
      expectedHeadSha: 'a'.repeat(40),
      expectedBaseSha: 'b'.repeat(40),
    });
    const observation = vi.mocked(observations.recordPullRequest).mock.calls[0]?.[0];
    expect(observation?.receiptEvaluation).toMatchObject({
      status: 'eligible',
      receiptId: expect.stringMatching(/^receipt-/),
      envelopeSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(observation?.receiptEvaluation)).not.toContain('signature');
  });

  it('re-evaluates the latest same-head review when required checks finish later', async () => {
    const { privateKey } = generateKeyPairSync('ed25519');
    const policy: ReceiptPolicy = {
      repositoryFullName: 'RevealUIStudio/revealui',
      keyId: 'receipt-key-1',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      version: 'policy-1',
      maxLifetimeMs: 21_600_000,
      requiredChecks: [{ name: 'CI', appId: 77 }],
    };
    const now = Date.now();
    const { client, observations } = fixtures();
    vi.mocked(observations.listReviewObservations).mockResolvedValue([
      {
        provider: 'codex-subscription',
        reviewerLogin: 'chatgpt-codex-connector[bot]',
        reviewerId: 90210,
        reviewId: 86,
        reviewedHeadSha: 'a'.repeat(40),
        currentHeadSha: 'a'.repeat(40),
        state: 'approved',
        action: 'submitted',
        observedAt: new Date(now - 120_000).toISOString(),
        bodySha256: '1'.repeat(64),
        inlineCommentCount: 0,
        inlineComments: [],
        submittedAt: new Date(now - 120_000).toISOString(),
        exactHead: true,
        receiptReview: {
          reviewerId: 'github-user:90210',
          system: 'openai-codex-subscription',
          executionId: 'github-review:86',
          revisionSha: 'a'.repeat(40),
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
      },
    ]);
    vi.mocked(client.listCheckRuns).mockResolvedValue([
      {
        id: 102,
        check_suite: { id: 202 },
        name: 'CI',
        head_sha: 'a'.repeat(40),
        status: 'completed',
        conclusion: 'success',
        completed_at: new Date(now - 60_000).toISOString(),
        app: { id: 77, slug: 'github-actions' },
      },
    ]);
    const handler = new ShadowWebhookHandler(client, observations, policy);
    await handler.process(
      webhook('check_run', {
        action: 'completed',
        check_run: { pull_requests: [{ number: 7 }] },
      }),
    );
    expect(observations.listReviewObservations).toHaveBeenCalledWith({
      repositoryId: 300,
      pullRequest: 7,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
    });
    expect(
      vi.mocked(observations.recordPullRequest).mock.calls[0]?.[0].receiptEvaluation,
    ).toMatchObject({
      status: 'eligible',
    });
  });

  it('records subscription Codex reviews only when GitHub binds them to the current PR head', async () => {
    const { client, observations, handler } = fixtures();
    vi.mocked(client.listPullRequestReviewComments).mockResolvedValue([
      {
        id: 909,
        pull_request_review_id: 81,
        path: 'src/private.ts',
        line: 12,
        commit_id: 'a'.repeat(40),
        body: '[P0] A private inline finding with source excerpt',
        user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
      },
      {
        id: 910,
        pull_request_review_id: 81,
        path: 'src/other.ts',
        line: null,
        commit_id: 'a'.repeat(40),
        body: 'An unclassified comment is conservatively high severity',
        user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
      },
    ]);
    const review = {
      id: 81,
      user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
      commit_id: 'a'.repeat(40),
      state: 'COMMENTED',
      body: 'A private finding with code details',
      submitted_at: '2026-10-06T12:01:00Z',
    };
    await handler.process(
      webhook('pull_request_review', {
        action: 'submitted',
        pull_request: { number: 7 },
        review,
      }),
    );
    const observed = vi.mocked(observations.recordPullRequest).mock.calls[0]?.[0];
    expect(observed?.reviewEvidence).toEqual({
      status: 'observed',
      review: expect.objectContaining({
        provider: 'codex-subscription',
        reviewerLogin: 'chatgpt-codex-connector[bot]',
        reviewerId: 90210,
        reviewId: 81,
        reviewedHeadSha: 'a'.repeat(40),
        currentHeadSha: 'a'.repeat(40),
        exactHead: true,
        inlineCommentCount: 2,
        inlineComments: expect.arrayContaining([
          expect.objectContaining({
            commentId: 909,
            path: 'src/private.ts',
            line: 12,
            severity: 'critical',
          }),
        ]),
        receiptReview: {
          reviewerId: 'github-user:90210',
          system: 'openai-codex-subscription',
          executionId: 'github-review:81',
          revisionSha: 'a'.repeat(40),
          verdict: 'request-changes',
          criticalFindings: 1,
          highFindings: 1,
        },
      }),
    });
    expect(JSON.stringify(observed?.reviewEvidence)).not.toContain('private finding');
    expect(JSON.stringify(observed?.reviewEvidence)).not.toContain('source excerpt');
  });

  it('creates an approving receipt-review candidate only for a clean exact-head Codex review', async () => {
    const { observations, handler } = fixtures();
    await handler.process(
      webhook('pull_request_review', {
        action: 'submitted',
        pull_request: { number: 7 },
        review: {
          id: 83,
          user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
          commit_id: 'a'.repeat(40),
          state: 'APPROVED',
          body: 'No blocking findings.',
          submitted_at: '2026-10-06T12:02:00Z',
        },
      }),
    );
    expect(
      vi.mocked(observations.recordPullRequest).mock.calls[0]?.[0].reviewEvidence,
    ).toMatchObject({
      status: 'observed',
      review: {
        exactHead: true,
        inlineCommentCount: 0,
        receiptReview: {
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
      },
    });
  });

  it('does not treat a comment-only review with no inline comments as approval', async () => {
    const { observations, handler } = fixtures();
    await handler.process(
      webhook('pull_request_review', {
        action: 'submitted',
        pull_request: { number: 7 },
        review: {
          id: 84,
          user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
          commit_id: 'a'.repeat(40),
          state: 'COMMENTED',
          body: 'Review complete.',
          submitted_at: '2026-10-06T12:03:00Z',
        },
      }),
    );
    expect(
      vi.mocked(observations.recordPullRequest).mock.calls[0]?.[0].reviewEvidence,
    ).toMatchObject({
      status: 'observed',
      review: {
        exactHead: true,
        inlineCommentCount: 0,
        receiptReview: { verdict: 'request-changes' },
      },
    });
  });

  it('records stale Codex reviews as ineligible and ignores other review authors', async () => {
    const { observations, handler } = fixtures();
    const makeReview = (login: string, commit: string) => ({
      id: 82,
      user: { id: 90210, login, type: 'Bot' },
      commit_id: commit,
      state: 'COMMENTED',
      body: '',
      submitted_at: '2026-10-06T12:01:00Z',
    });
    await handler.process(
      webhook('pull_request_review', {
        action: 'submitted',
        pull_request: { number: 7 },
        review: makeReview('chatgpt-codex-connector[bot]', 'b'.repeat(40)),
      }),
    );
    await handler.process(
      webhook('pull_request_review', {
        action: 'submitted',
        pull_request: { number: 7 },
        review: makeReview('someone-else[bot]', 'a'.repeat(40)),
      }),
    );
    const calls = vi.mocked(observations.recordPullRequest).mock.calls;
    expect(calls[0]?.[0].reviewEvidence).toMatchObject({
      status: 'observed',
      review: { exactHead: false },
    });
    expect(calls[1]?.[0].reviewEvidence).toEqual({ status: 'not_requested' });
  });

  it('fails closed on a webhook from a repository outside the App scope', async () => {
    const { handler } = fixtures();
    await expect(
      handler.process({
        ...webhook('pull_request', { pull_request: { number: 7 } }),
        repositoryId: 301,
      }),
    ).rejects.toMatchObject({ code: 'repository_scope_mismatch' });
  });

  it('does not fabricate PR evidence when GitHub gives a check event with no PR association', async () => {
    const { client, observations, handler } = fixtures();
    await handler.process(webhook('check_run', { check_run: { pull_requests: [] } }));
    expect(client.getPullRequest).not.toHaveBeenCalled();
    expect(observations.recordPullRequest).not.toHaveBeenCalled();
  });
});
