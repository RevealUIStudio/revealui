import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { GitHubAppClient } from './github-app.js';
import type { PullRequestSnapshot } from './snapshot.js';
import { requestStructuredReview, TrustedReviewerWebhookHandler } from './trusted-reviewer.js';

const headSha = 'a'.repeat(40);
const baseSha = 'b'.repeat(40);
const snapshot: PullRequestSnapshot = {
  repositoryId: 300,
  pullRequest: 7,
  state: 'open',
  draft: false,
  baseRef: 'test',
  headSha,
  headTreeSha: 'c'.repeat(40),
  baseSha,
  baseTreeSha: 'd'.repeat(40),
  manifest: { files: [], fileCount: 0, sha256: createHash('sha256').update('[]').digest('hex') },
  content: [],
  securityClassification: { classifierVersion: 'test', sensitivePaths: [] },
};

function github() {
  return {
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
    listPullRequestReviews: vi.fn(async () => []),
    submitPullRequestReview: vi.fn(async () => 123),
  } as unknown as GitHubAppClient;
}

describe('trusted reviewer', () => {
  it('submits an exact-head native approval with base, manifest, and policy binding', async () => {
    const client = github();
    const review = vi.fn(async () => ({
      verdict: 'approve' as const,
      summary: 'No blocking findings.',
      findings: [],
    }));
    const handler = new TrustedReviewerWebhookHandler(
      client,
      {
        repositoryId: 300,
        reviewer: { id: 90211, login: 'revealui-reviewer[bot]' },
        policyVersion: 'review-policy-1',
        model: 'gpt-6-astra',
      },
      review,
    );
    await handler.reviewPullRequest(7);
    expect(review).toHaveBeenCalledWith(expect.objectContaining({ headSha, baseSha }));
    expect(client.submitPullRequestReview).toHaveBeenCalledWith(
      expect.objectContaining({
        pullNumber: 7,
        commitId: headSha,
        event: 'APPROVE',
        body: JSON.stringify({
          binding: {
            version: 1,
            repositoryId: 300,
            pullRequest: 7,
            headSha,
            baseSha,
            manifestSha256: snapshot.manifest.sha256,
            policyVersion: 'review-policy-1',
            model: 'gpt-6-astra',
          },
          summary: 'No blocking findings.',
          findings: [],
        }),
      }),
    );
  });

  it('does not submit a review when the head changes during model evaluation', async () => {
    const client = github();
    let calls = 0;
    vi.mocked(client.getPullRequest).mockImplementation(async () => ({
      number: 7,
      state: 'open',
      draft: false,
      head: { sha: ++calls === 1 ? headSha : 'e'.repeat(40) },
      base: { sha: baseSha, ref: 'test' },
    }));
    const handler = new TrustedReviewerWebhookHandler(
      client,
      {
        repositoryId: 300,
        reviewer: { id: 90211, login: 'revealui-reviewer[bot]' },
        policyVersion: 'review-policy-1',
        model: 'gpt-6-astra',
      },
      async () => ({ verdict: 'approve', summary: 'Clean.', findings: [] }),
    );
    await expect(handler.reviewPullRequest(7)).rejects.toMatchObject({
      code: 'pull_request_changed_during_review',
    });
    expect(client.submitPullRequestReview).not.toHaveBeenCalled();
  });

  it('fails closed on incomplete or refused model responses', async () => {
    const result = (status: string, content: unknown[]) =>
      Response.json({
        status,
        output: [{ type: 'message', content }],
      });
    const fetchImpl = vi.fn(async () =>
      result('incomplete', [
        {
          type: 'output_text',
          text: '{"verdict":"approve","summary":"ok","findings":[]}',
        },
      ]),
    ) as unknown as typeof fetch;
    await expect(
      requestStructuredReview({
        snapshot,
        apiKey: 'test-key',
        model: 'gpt-6-astra',
        policyVersion: 'review-policy-1',
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'incomplete_model_response' });
    vi.mocked(fetchImpl).mockResolvedValueOnce(
      result('completed', [{ type: 'refusal', refusal: 'no' }]),
    );
    await expect(
      requestStructuredReview({
        snapshot,
        apiKey: 'test-key',
        model: 'gpt-6-astra',
        policyVersion: 'review-policy-1',
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'model_review_refused' });
    const request = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({ store: false, text: { format: { strict: true } } });
    expect(request.tools).toBeUndefined();
  });
});
