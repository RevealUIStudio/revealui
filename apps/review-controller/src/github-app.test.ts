import { generateKeyPairSync, verify } from 'node:crypto';
import {
  canonicalReviewReceiptEnvelope,
  REVIEW_RECEIPT_SCHEMA,
  type ReviewReceiptContext,
  signReviewReceipt,
} from '@revealui/security/review-receipt';
import { describe, expect, it, vi } from 'vitest';
import { GitHubAppClient, type GitHubAppError } from './github-app.js';

const now = Date.parse('2026-10-06T12:00:00.000Z');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function fixture(fetchImpl: typeof fetch, receiptEvaluationEnabled = false) {
  return new GitHubAppClient(
    {
      appId: 100,
      installationId: 200,
      repositoryId: 300,
      repositoryFullName: 'RevealUIStudio/revealui',
      privateKey: pem,
      receiptEvaluationEnabled,
    },
    fetchImpl,
    () => now,
  );
}

function tokenResponse() {
  return new Response(
    JSON.stringify({ token: `ghs_${'x'.repeat(36)}`, expires_at: '2026-10-06T13:00:00Z' }),
    { status: 201, headers: { 'content-type': 'application/json' } },
  );
}

function signedEnvelope(headSha: string): string {
  const pair = generateKeyPairSync('ed25519');
  const tree = (letter: string) => letter.repeat(40);
  const digest = (letter: string) => letter.repeat(64);
  const clock = new Date(now);
  const expected: ReviewReceiptContext = {
    repositoryId: 300,
    repositoryFullName: 'RevealUIStudio/revealui',
    pullRequest: 3076,
    headSha,
    headTreeSha: tree('b'),
    baseSha: tree('c'),
    baseTreeSha: tree('d'),
    mergeCandidateTreeSha: tree('e'),
    manifestSha256: digest('f'),
    policyVersion: 'policy-1',
    classifierVersion: 'classifier-1',
    requiredChecks: [{ name: 'CI', appId: 20, checkRunId: 101, checkSuiteId: 201 }],
    minimumIndependentReviews: 1,
    maxReceiptLifetimeMs: 60 * 60_000,
    now: clock,
  };
  return canonicalReviewReceiptEnvelope(
    signReviewReceipt({
      keyId: 'controller-key-1',
      privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }),
      expected,
      receipt: {
        schema: REVIEW_RECEIPT_SCHEMA,
        receiptId: `receipt-${digest('1')}`,
        issuedAt: new Date(clock.getTime() - 60_000).toISOString(),
        expiresAt: new Date(clock.getTime() + 30 * 60_000).toISOString(),
        repository: { id: expected.repositoryId, fullName: expected.repositoryFullName },
        pullRequest: expected.pullRequest,
        head: { sha: expected.headSha, treeSha: expected.headTreeSha },
        base: { sha: expected.baseSha, treeSha: expected.baseTreeSha },
        mergeCandidate: { treeSha: expected.mergeCandidateTreeSha },
        manifest: { sha256: expected.manifestSha256, fileCount: 1 },
        policy: {
          version: expected.policyVersion,
          classifierVersion: expected.classifierVersion,
        },
        reviews: [
          {
            reviewerId: 'reviewer-1',
            system: 'system-1',
            executionId: 'execution-1',
            revisionSha: headSha,
            verdict: 'approve',
            criticalFindings: 0,
            highFindings: 0,
          },
        ],
        checks: [
          {
            name: 'CI',
            appId: 20,
            checkRunId: 101,
            checkSuiteId: 201,
            conclusion: 'success',
            evidenceSha256: digest('2'),
          },
        ],
        decision: 'approve',
      },
    }),
  );
}

describe('GitHub App API client', () => {
  it('requests Actions read only for receipt evaluation and validates workflow-run metadata', async () => {
    const headSha = 'a'.repeat(40);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (url.pathname.endsWith('/actions/runs'))
        return new Response(
          JSON.stringify({
            total_count: 1,
            workflow_runs: [
              {
                id: 301,
                check_suite_id: 201,
                workflow_id: 401,
                head_sha: headSha,
                path: '.github/workflows/ci.yml',
                event: 'pull_request',
                status: 'completed',
                conclusion: 'success',
                repository: { id: 300 },
                head_repository: { id: 300 },
              },
            ],
          }),
          { status: 200 },
        );
      throw new Error(`unexpected URL ${url.pathname}`);
    });
    await expect(fixture(fetchImpl).listWorkflowRuns(headSha)).rejects.toMatchObject({
      code: 'receipt_workflow_access_disabled',
    });
    const client = fixture(fetchImpl, true);
    await expect(client.listWorkflowRuns(headSha)).resolves.toMatchObject([
      { id: 301, check_suite_id: 201, workflow_id: 401 },
    ]);
    const tokenCall = fetchImpl.mock.calls.find(([url]) => String(url).includes('/access_tokens'));
    expect(JSON.parse(String(tokenCall?.[1]?.body)).permissions).toMatchObject({ actions: 'read' });
  });

  it('uses GitHub reset metadata and pauses further API calls when the installation limit is exhausted', async () => {
    const resetSeconds = Math.floor(now / 1000) + 300;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes('/access_tokens')) return tokenResponse();
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(resetSeconds),
        },
      });
    });
    const client = fixture(fetchImpl);
    await expect(client.getTree('a'.repeat(40))).rejects.toMatchObject({
      code: 'github_rate_limited',
      retryAt: resetSeconds * 1000 + 5_000,
    });
    await expect(client.getTree('a'.repeat(40))).rejects.toMatchObject({
      code: 'github_rate_limited',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('publishes a fixed App-authored receipt check carrying the canonical envelope', async () => {
    const headSha = 'a'.repeat(40);
    const receiptEnvelope = signedEnvelope(headSha);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (url.pathname.includes('/check-runs') && init?.method === 'GET')
        return new Response(JSON.stringify({ total_count: 0, check_runs: [] }), { status: 200 });
      expect(url.pathname).toBe('/repos/RevealUIStudio/revealui/check-runs');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        name: 'RevealUI Receipt',
        head_sha: headSha,
        external_id: 'receipt-123',
        status: 'completed',
        conclusion: 'success',
        completed_at: '2026-10-06T12:00:00.000Z',
        output: {
          title: 'Receipt evidence is ready',
          summary: `Exact-head review and required check evidence passed receipt evaluation.\n\n<!-- revealui-review-receipt:v1 -->\n${receiptEnvelope}`,
        },
      });
      return new Response(
        JSON.stringify({
          id: 800,
          name: 'RevealUI Receipt',
          head_sha: headSha,
          status: 'completed',
          conclusion: 'success',
          external_id: 'receipt-123',
        }),
        { status: 201 },
      );
    });
    await expect(
      fixture(fetchImpl).upsertReceiptCheckRun({
        headSha,
        externalId: 'receipt-123',
        eligible: true,
        receiptEnvelope,
      }),
    ).resolves.toEqual({
      id: 800,
      name: 'RevealUI Receipt',
      head_sha: headSha,
      status: 'completed',
      conclusion: 'success',
      external_id: 'receipt-123',
    });
  });

  it('rejects an eligible receipt check without a canonical signed envelope', async () => {
    const client = fixture(vi.fn<typeof fetch>());
    await expect(
      client.upsertReceiptCheckRun({
        headSha: 'a'.repeat(40),
        externalId: 'receipt-123',
        eligible: true,
      }),
    ).rejects.toThrow('eligible receipt check requires a signed envelope');
  });

  it('rejects mismatched GitHub receipt check responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (url.pathname.includes('/check-runs') && init?.method === 'GET')
        return new Response(JSON.stringify({ total_count: 0, check_runs: [] }), { status: 200 });
      return new Response(JSON.stringify({ id: 1, name: 'Unexpected', head_sha: 'a'.repeat(40) }), {
        status: 201,
      });
    });
    await expect(
      fixture(fetchImpl).upsertReceiptCheckRun({
        headSha: 'a'.repeat(40),
        externalId: 'receipt-1',
        eligible: false,
      }),
    ).rejects.toMatchObject({ code: 'invalid_receipt_check_run_response' });
  });

  it('updates the matching check on retry instead of creating a duplicate', async () => {
    const headSha = 'a'.repeat(40);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (
        url.pathname.includes('/check-runs?') ||
        (url.pathname.endsWith('/check-runs') && init?.method === 'GET')
      )
        return new Response(
          JSON.stringify({
            total_count: 1,
            check_runs: [
              {
                id: 800,
                check_suite: { id: 801 },
                name: 'RevealUI Receipt',
                head_sha: headSha,
                status: 'completed',
                conclusion: 'failure',
                completed_at: '2026-10-06T11:59:00Z',
                external_id: 'pr-300-7',
                app: { id: 100, slug: 'review-controller' },
              },
            ],
          }),
          { status: 200 },
        );
      expect(init?.method).toBe('PATCH');
      expect(url.pathname).toBe('/repos/RevealUIStudio/revealui/check-runs/800');
      expect(JSON.parse(String(init?.body))).not.toHaveProperty('head_sha');
      return new Response(
        JSON.stringify({
          id: 800,
          name: 'RevealUI Receipt',
          head_sha: headSha,
          status: 'completed',
          conclusion: 'success',
          external_id: 'pr-300-7',
        }),
        { status: 200 },
      );
    });
    await expect(
      fixture(fetchImpl).upsertReceiptCheckRun({
        headSha,
        externalId: 'pr-300-7',
        eligible: true,
        receiptEnvelope: signedEnvelope(headSha),
      }),
    ).resolves.toMatchObject({ id: 800, conclusion: 'success' });
  });

  it('collects a fresh merge candidate only while the PR head and base still match', async () => {
    const headSha = 'a'.repeat(40);
    const baseSha = 'b'.repeat(40);
    const mergeSha = 'c'.repeat(40);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (url.pathname.endsWith('/pulls/7'))
        return new Response(
          JSON.stringify({
            number: 7,
            state: 'open',
            draft: false,
            mergeable: true,
            head: { sha: headSha, repo: { id: 300 } },
            base: { sha: baseSha, repo: { id: 300 } },
            merge_commit_sha: mergeSha,
          }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ tree: { sha: 'd'.repeat(40) } }), { status: 200 });
    });
    const client = fixture(fetchImpl);
    await expect(
      client.getFreshMergeCandidate({
        pullNumber: 7,
        expectedHeadSha: headSha,
        expectedBaseSha: baseSha,
      }),
    ).resolves.toEqual({ mergeCommitSha: mergeSha, treeSha: 'd'.repeat(40) });
    await expect(
      client.getFreshMergeCandidate({
        pullNumber: 7,
        expectedHeadSha: 'e'.repeat(40),
        expectedBaseSha: baseSha,
      }),
    ).rejects.toMatchObject({ code: 'merge_candidate_pull_request_changed' });
  });

  it('mints an installation token restricted to the configured repository and minimum permissions', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const client = fixture(fetchImpl);
    await client.getPullRequest(7).catch(() => undefined);

    const [input, init] = fetchImpl.mock.calls[0] ?? [];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.pathname).toBe('/app/installations/200/access_tokens');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toMatch(/^Bearer [A-Za-z0-9_.-]+$/);
    const jwt = headers.get('authorization')?.slice('Bearer '.length) ?? '';
    const [encodedHeader, encodedClaims, encodedSignature] = jwt.split('.');
    const unsigned = `${encodedHeader}.${encodedClaims}`;
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(unsigned),
        publicKey,
        Buffer.from(encodedSignature ?? '', 'base64url'),
      ),
    ).toBe(true);
    expect(JSON.parse(Buffer.from(encodedClaims ?? '', 'base64url').toString('utf8'))).toEqual({
      iat: Math.floor(now / 1000) - 60,
      exp: Math.floor(now / 1000) + 8 * 60,
      iss: '100',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      repository_ids: [300],
      permissions: {
        checks: 'write',
        contents: 'read',
        merge_queues: 'read',
        pull_requests: 'write',
      },
    });
  });

  it('uses a separate reviewer token with no check or merge-queue permission', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (init?.method === 'POST' && url.pathname.endsWith('/reviews'))
        return Response.json(
          {
            id: 91,
            commit_id: 'a'.repeat(40),
            state: 'APPROVED',
            user: { id: 90211, login: 'revealui-reviewer[bot]', type: 'Bot' },
          },
          { status: 200 },
        );
      return Response.json({ error: 'unexpected' }, { status: 404 });
    });
    const client = new GitHubAppClient(
      {
        appId: 101,
        installationId: 201,
        repositoryId: 300,
        repositoryFullName: 'RevealUIStudio/revealui',
        privateKey: pem,
        role: 'reviewer',
      },
      fetchImpl,
      () => now,
    );
    await expect(
      client.submitPullRequestReview({
        pullNumber: 7,
        commitId: 'a'.repeat(40),
        event: 'APPROVE',
        body: '{}',
        reviewer: { id: 90211, login: 'revealui-reviewer[bot]' },
      }),
    ).resolves.toBe(91);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      repository_ids: [300],
      permissions: { contents: 'read', pull_requests: 'write' },
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      commit_id: 'a'.repeat(40),
      event: 'APPROVE',
      body: '{}',
    });
  });

  it('fetches complete paginated changed-file evidence and reuses the short-lived token', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      if (url.pathname.endsWith('/files') && url.searchParams.get('page') !== '2') {
        return new Response(
          JSON.stringify([
            {
              filename: 'src/a.ts',
              status: 'modified',
              sha: 'a'.repeat(40),
              additions: 1,
              deletions: 0,
              changes: 1,
            },
          ]),
          {
            status: 200,
            headers: {
              link: '<https://api.github.com/repositories/300/pulls/7/files?per_page=100&page=2>; rel="next"',
            },
          },
        );
      }
      if (url.pathname.endsWith('/files')) {
        expect(url.pathname).toBe('/repositories/300/pulls/7/files');
        return new Response(
          JSON.stringify([
            {
              filename: 'src/b.ts',
              status: 'added',
              sha: 'b'.repeat(40),
              additions: 3,
              deletions: 0,
              changes: 3,
            },
          ]),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const files = await fixture(fetchImpl).listPullRequestFiles(7);
    expect(files.map((file) => file.filename)).toEqual(['src/a.ts', 'src/b.ts']);
    expect(
      fetchImpl.mock.calls.filter(([input]) => String(input).includes('/access_tokens')),
    ).toHaveLength(1);
  });

  it('fails closed when GitHub truncates a recursive tree', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response(JSON.stringify({ truncated: true, tree: [] }), { status: 200 });
    });
    await expect(fixture(fetchImpl).getTree('a'.repeat(40))).rejects.toMatchObject<
      Partial<GitHubAppError>
    >({
      code: 'incomplete_git_tree',
    });
  });

  it('accepts only attributed check runs on the exact requested head', async () => {
    const headSha = 'c'.repeat(40);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response(
        JSON.stringify({
          total_count: 1,
          check_runs: [
            {
              id: 91,
              check_suite: { id: 90 },
              name: 'ci / test',
              head_sha: headSha,
              status: 'completed',
              conclusion: 'success',
              completed_at: '2026-10-06T12:00:00Z',
              app: { id: 12, slug: 'github-actions' },
            },
          ],
        }),
        { status: 200 },
      );
    });
    await expect(fixture(fetchImpl).listCheckRuns(headSha)).resolves.toMatchObject([
      { name: 'ci / test', head_sha: headSha, app: { id: 12 }, id: 91, check_suite: { id: 90 } },
    ]);
  });

  it('fetches review comments scoped to a review ID and exact reviewed commit', async () => {
    const headSha = 'c'.repeat(40);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      expect(url.pathname).toBe('/repos/RevealUIStudio/revealui/pulls/7/reviews/81/comments');
      return new Response(
        JSON.stringify([
          {
            id: 91,
            pull_request_review_id: 81,
            path: 'src/a.ts',
            line: 10,
            commit_id: headSha,
            body: 'finding details',
            user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
          },
        ]),
        { status: 200 },
      );
    });
    await expect(
      fixture(fetchImpl).listPullRequestReviewComments(7, 81, headSha),
    ).resolves.toMatchObject([{ id: 91, pull_request_review_id: 81, commit_id: headSha }]);
  });

  it('rejects review comments from another review or commit', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response(
        JSON.stringify([
          {
            id: 91,
            pull_request_review_id: 80,
            path: 'src/a.ts',
            line: 10,
            commit_id: 'd'.repeat(40),
            body: 'finding details',
            user: { id: 90210, login: 'chatgpt-codex-connector[bot]', type: 'Bot' },
          },
        ]),
        { status: 200 },
      );
    });
    await expect(
      fixture(fetchImpl).listPullRequestReviewComments(7, 81, 'c'.repeat(40)),
    ).rejects.toMatchObject({ code: 'invalid_review_comment' });
  });

  it('rejects a check run returned for a different head', async () => {
    const requestedSha = 'c'.repeat(40);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response(
        JSON.stringify({
          total_count: 1,
          check_runs: [
            {
              id: 91,
              check_suite: { id: 90 },
              name: 'ci / test',
              head_sha: 'd'.repeat(40),
              status: 'completed',
              conclusion: 'success',
              completed_at: '2026-10-06T12:00:00Z',
              app: { id: 12, slug: 'github-actions' },
            },
          ],
        }),
        { status: 200 },
      );
    });
    await expect(fixture(fetchImpl).listCheckRuns(requestedSha)).rejects.toMatchObject({
      code: 'invalid_check_run',
    });
  });

  it('rejects pagination links outside api.github.com', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response('[]', {
        status: 200,
        headers: { link: '<https://attacker.example/steal?page=2>; rel="next"' },
      });
    });
    await expect(fixture(fetchImpl).listPullRequestFiles(7)).rejects.toMatchObject({
      code: 'pagination_link_out_of_scope',
    });
  });

  it.each([
    ['different repository', '/repositories/301/pulls/7/files'],
    ['different endpoint', '/repositories/300/pulls/8/files'],
  ])('rejects a canonical pagination link for a %s', async (_, path) => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname.endsWith('/access_tokens')) return tokenResponse();
      return new Response('[]', {
        status: 200,
        headers: {
          link: `<https://api.github.com${path}?per_page=100&page=2>; rel="next"`,
        },
      });
    });
    await expect(fixture(fetchImpl).listPullRequestFiles(7)).rejects.toMatchObject({
      code: 'pagination_link_out_of_scope',
    });
  });

  it('rejects App credentials that are not RSA keys', () => {
    expect(
      () =>
        new GitHubAppClient({
          appId: 100,
          installationId: 200,
          repositoryId: 300,
          repositoryFullName: 'RevealUIStudio/revealui',
          privateKey: 'invalid',
        }),
    ).toThrow('invalid GitHub App private key');
  });

  it.each([
    ['PKCS#1', privateKey.export({ type: 'pkcs1', format: 'pem' }).toString()],
    ['PKCS#8', pem],
  ])(
    'accepts a complete %s App PEM whose line breaks were collapsed by a secret editor',
    (_, key) => {
      expect(
        () =>
          new GitHubAppClient({
            appId: 100,
            installationId: 200,
            repositoryId: 300,
            repositoryFullName: 'RevealUIStudio/revealui',
            privateKey: key.replace(/\r?\n/g, ' '),
          }),
      ).not.toThrow();
    },
  );
});
