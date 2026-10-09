import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { GitHubAppClient } from './github-app.js';
import type { PullRequestSnapshot } from './snapshot.js';
import { matchesTrustedReviewBinding, trustedReviewBinding } from './trusted-review-binding.js';
import { REVIEW_CONTRACT_SHA256 } from './trusted-review-contract.js';
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
            version: 2,
            reviewContractSha256: REVIEW_CONTRACT_SHA256,
            repositoryId: 300,
            pullRequest: 7,
            headSha,
            baseSha,
            manifestSha256: snapshot.manifest.sha256,
            policyVersion: 'review-policy-1',
            model: 'gpt-6-astra',
          },
          summary: 'Trusted review completed. <!-- guardrail2-verdict: APPROVE -->',
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
        apiKey: 'sk-synthetic-test-key-not-live',
        projectId: 'proj_synthetic123456',
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
        apiKey: 'sk-synthetic-test-key-not-live',
        projectId: 'proj_synthetic123456',
        model: 'gpt-6-astra',
        policyVersion: 'review-policy-1',
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: 'model_review_refused' });
    const request = JSON.parse(String(vi.mocked(fetchImpl).mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({ store: false, text: { format: { strict: true } } });
    expect(request).toMatchObject({ tools: [], tool_choice: 'none' });
  });
});

function modelResponse(decision: unknown, extra: unknown[] = []) {
  return Response.json({
    status: 'completed',
    output: [
      ...extra,
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(decision) }] },
    ],
  });
}
function assessment(overrides: Record<string, unknown> = {}) {
  return {
    verdict: 'approve',
    summary: 'Reviewed.',
    findings: [],
    confidence: 0.95,
    needs: [],
    checklist: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [
        String(i + 1),
        'Assessed against the supplied base and head.',
      ]),
    ),
    ...overrides,
  };
}
function evaluate(fetchImpl: typeof fetch) {
  return requestStructuredReview({
    snapshot,
    apiKey: 'sk-synthetic-test-key-not-live',
    projectId: 'proj_synthetic123456',
    model: 'gpt-6-astra',
    policyVersion: 'review-policy-1',
    fetchImpl,
  });
}
describe('trusted review quality contract', () => {
  it('requires three distinct fresh review lenses before approval', async () => {
    const transport = vi.fn(async () => modelResponse(assessment())) as unknown as typeof fetch;
    await expect(evaluate(transport)).resolves.toMatchObject({ verdict: 'approve', findings: [] });
    expect(transport).toHaveBeenCalledTimes(3);
    const requests = vi
      .mocked(transport)
      .mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(new Set(requests.map((request) => request.instructions)).size).toBe(3);
    for (const request of requests)
      expect(request).toMatchObject({ tools: [], tool_choice: 'none', store: false });
  });
  it.each([
    { verdict: 'approve', summary: 'ok', findings: [] },
    assessment({ confidence: 0.4 }),
    assessment({ needs: ['Missing dependency context'] }),
    assessment({ checklist: { '1': 'Only one item assessed.' } }),
  ])('cannot approve an incomplete assessment: %j', async (decision) => {
    const transport = vi.fn(async () => modelResponse(decision)) as unknown as typeof fetch;
    await expect(evaluate(transport)).rejects.toBeDefined();
  });
  it('retains a rejection without resampling it into approval', async () => {
    const transport = vi.fn(async () =>
      modelResponse(assessment({ verdict: 'request_changes', findings: ['Private finding.'] })),
    ) as unknown as typeof fetch;
    await expect(evaluate(transport)).resolves.toMatchObject({ verdict: 'request_changes' });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('rejects unexpected provider tool output even alongside an approval', async () => {
    const transport = vi.fn(async () =>
      modelResponse(assessment(), [{ type: 'function_call', name: 'shell' }]),
    ) as unknown as typeof fetch;
    await expect(evaluate(transport)).rejects.toBeDefined();
  });
  it('does not review draft pull requests', async () => {
    const client = github();
    vi.mocked(client.getPullRequest).mockResolvedValue({
      number: 7,
      state: 'open',
      draft: true,
      head: { sha: headSha },
      base: { sha: baseSha, ref: 'test' },
    });
    const review = vi.fn(async () => ({
      verdict: 'approve' as const,
      summary: 'Clean.',
      findings: [],
    }));
    await new TrustedReviewerWebhookHandler(
      client,
      {
        repositoryId: 300,
        reviewer: { id: 90211, login: 'revealui-reviewer[bot]' },
        policyVersion: 'review-policy-1',
        model: 'gpt-6-astra',
      },
      review,
    ).reviewPullRequest(7);
    expect(review).not.toHaveBeenCalled();
    expect(client.submitPullRequestReview).not.toHaveBeenCalled();
  });
  it('keeps model findings and source details out of public reviews', async () => {
    const client = github();
    await new TrustedReviewerWebhookHandler(
      client,
      {
        repositoryId: 300,
        reviewer: { id: 90211, login: 'revealui-reviewer[bot]' },
        policyVersion: 'review-policy-1',
        model: 'gpt-6-astra',
      },
      async () => ({
        verdict: 'request_changes',
        summary: 'PRIVATE-SOURCE-DETAIL',
        findings: ['PRIVATE-REPRODUCTION'],
      }),
    ).reviewPullRequest(7);
    const submitted = vi.mocked(client.submitPullRequestReview).mock.calls[0]?.[0];
    expect(submitted?.event).toBe('REQUEST_CHANGES');
    expect(submitted?.body).not.toContain('PRIVATE');
    expect(submitted?.body).toContain('<!-- guardrail2-verdict: REQUEST-CHANGES -->');
  });
});

describe('trusted review freshness and uncertainty', () => {
  it('allows bounded uncertainty recovery without sharing conversation state', async () => {
    const transport = vi.fn(async () => modelResponse(assessment())) as unknown as typeof fetch;
    vi.mocked(transport).mockResolvedValueOnce(
      modelResponse(assessment({ verdict: 'uncertain', needs: ['Context unclear'] })),
    );
    await expect(evaluate(transport)).resolves.toMatchObject({ verdict: 'approve' });
    expect(transport).toHaveBeenCalledTimes(4);
    for (const call of vi.mocked(transport).mock.calls)
      expect(JSON.parse(String(call[1]?.body))).not.toHaveProperty('previous_response_id');
  });
  it('caps uncertainty at three attempts without starting later lenses', async () => {
    const transport = vi.fn(async () =>
      modelResponse(assessment({ verdict: 'uncertain' })),
    ) as unknown as typeof fetch;
    await expect(evaluate(transport)).rejects.toMatchObject({ code: 'review_model_uncertain' });
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('vetoes findings even if the model labels its verdict approve', async () => {
    const transport = vi.fn(async () =>
      modelResponse(assessment({ findings: ['Blocking finding'] })),
    ) as unknown as typeof fetch;
    await expect(evaluate(transport)).resolves.toMatchObject({ verdict: 'request_changes' });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('invalidates approvals bound to a previous review contract', () => {
    const binding = trustedReviewBinding(snapshot, 'review-policy-1', 'gpt-6-astra');
    const body = (value: unknown) =>
      JSON.stringify({ binding: value, summary: 'Completed.', findings: [] });
    expect(
      matchesTrustedReviewBinding(body(binding), snapshot, 'review-policy-1', 'gpt-6-astra'),
    ).toBe(true);
    expect(
      matchesTrustedReviewBinding(
        body({ ...binding, reviewContractSha256: '0'.repeat(64) }),
        snapshot,
        'review-policy-1',
        'gpt-6-astra',
      ),
    ).toBe(false);
    expect(
      matchesTrustedReviewBinding(
        body({ ...binding, version: 1 }),
        snapshot,
        'review-policy-1',
        'gpt-6-astra',
      ),
    ).toBe(false);
  });
  it('does not approve a pull request that becomes draft while being reviewed', async () => {
    const client = github();
    let calls = 0;
    vi.mocked(client.getPullRequest).mockImplementation(async () => ({
      number: 7,
      state: 'open',
      draft: ++calls > 1,
      head: { sha: headSha },
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
      async () => ({ verdict: 'approve', summary: 'Completed.', findings: [] }),
    );
    await expect(handler.reviewPullRequest(7)).rejects.toMatchObject({
      code: 'pull_request_changed_during_review',
    });
    expect(client.submitPullRequestReview).not.toHaveBeenCalled();
  });
});

describe('trusted reviewer transport boundaries', () => {
  it.each([
    assessment({ unexpected: true }),
    assessment({ confidence: Number.POSITIVE_INFINITY }),
    assessment({
      checklist: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), ' '])),
    }),
    assessment({ needs: [' '] }),
  ])('rejects malformed assessment structure: %j', async (decision) => {
    const transport = vi.fn(async () => modelResponse(decision)) as unknown as typeof fetch;
    await expect(evaluate(transport)).rejects.toMatchObject({ code: 'invalid_model_review' });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('bounds response bytes while reading and cancels the oversized stream', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(65 * 1024));
        },
        cancel,
      }),
    );
    const transport = vi.fn(async () => response) as unknown as typeof fetch;
    await expect(evaluate(transport)).rejects.toMatchObject({
      code: 'review_model_response_limit',
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it.each([401, 429, 503])(
    'fails closed on provider HTTP %i without verdict resampling',
    async (status) => {
      const transport = vi.fn(async () => new Response('', { status })) as unknown as typeof fetch;
      await expect(evaluate(transport)).rejects.toMatchObject({
        code: `review_model_http_${status}`,
      });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects unknown message content instead of ignoring it', async () => {
    const transport = vi.fn(async () =>
      Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              { type: 'unknown' },
              { type: 'output_text', text: JSON.stringify(assessment()) },
            ],
          },
        ],
      }),
    ) as unknown as typeof fetch;
    await expect(evaluate(transport)).rejects.toMatchObject({ code: 'unexpected_model_output' });
  });
  it('retains a veto in the second lens without running the third', async () => {
    const transport = vi.fn(async () => modelResponse(assessment())) as unknown as typeof fetch;
    vi.mocked(transport)
      .mockResolvedValueOnce(modelResponse(assessment()))
      .mockResolvedValueOnce(modelResponse(assessment({ verdict: 'request_changes' })));
    await expect(evaluate(transport)).resolves.toMatchObject({ verdict: 'request_changes' });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});

describe('trusted reviewer credential validation', () => {
  it.each([
    'label\nsk-synthetic-test-key-not-live',
    'sk-too-short',
    'sk-synthetic key-with-spaces',
    '',
    'sk-synthetic-test-key-not-live\n',
  ])('rejects malformed credential before building headers: %j', async (apiKey) => {
    const transport = vi.fn() as unknown as typeof fetch;
    await expect(
      requestStructuredReview({
        snapshot,
        apiKey,
        projectId: 'proj_synthetic123456',
        model: 'gpt-6-astra',
        policyVersion: 'review-policy-1',
        fetchImpl: transport,
      }),
    ).rejects.toMatchObject({ code: 'invalid_model_configuration' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('requires an explicitly scoped API project', async () => {
    const transport = vi.fn() as unknown as typeof fetch;
    await expect(
      requestStructuredReview({
        snapshot,
        apiKey: 'sk-synthetic-test-key-not-live',
        projectId: '',
        model: 'gpt-6-astra',
        policyVersion: 'review-policy-1',
        fetchImpl: transport,
      }),
    ).rejects.toMatchObject({ code: 'invalid_model_configuration' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('pins the approved project header without including credentials in model input', async () => {
    const transport = vi.fn(async () => modelResponse(assessment())) as unknown as typeof fetch;
    await evaluate(transport);
    const options = vi.mocked(transport).mock.calls[0]?.[1];
    expect(options?.headers).toMatchObject({ 'OpenAI-Project': 'proj_synthetic123456' });
    expect(options?.body).not.toContain('sk-synthetic-test-key-not-live');
  });
});
