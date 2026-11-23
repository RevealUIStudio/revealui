import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const { evaluateReceiptShadowForPr, verifyReceiptShadow } = require('../security-review-gate.cjs');
const gates = require('../../../packages/harnesses/dist/gates/index.cjs');

const sha = (letter: string) => letter.repeat(40);
const digest = (letter: string) => letter.repeat(64);
const now = new Date('2026-10-07T12:00:00.000Z');

function fixture(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const currentCheckRun = {
    name: 'CI / test',
    app: { id: 20 },
    head_sha: sha('a'),
    status: 'completed',
    conclusion: 'success',
    completed_at: '2026-10-07T11:45:00.000Z',
    id: 101,
    check_suite: { id: 201 },
  };
  const securityCheckRuns = [
    { name: 'CodeQL', app: { id: 57789 }, id: 102, suite: 202 },
    { name: 'Security Gate', app: { id: 15368 }, id: 103, suite: 203 },
    { name: 'Dependency Review', app: { id: 15368 }, id: 104, suite: 203 },
    { name: 'Secret Scanning (Gitleaks)', app: { id: 15368 }, id: 105, suite: 203 },
  ].map(({ suite, ...run }) => ({
    ...run,
    head_sha: sha('a'),
    status: 'completed',
    conclusion: 'success',
    completed_at: '2026-10-07T11:45:00.000Z',
    check_suite: { id: suite },
  }));
  const requiredChecks = [
    { name: 'CI / test', appId: 20 },
    { name: 'CodeQL', appId: 57789 },
    ...['Security Gate', 'Dependency Review', 'Secret Scanning (Gitleaks)'].map((name) => ({
      name,
      appId: 15368,
      workflowId: 401,
      workflowPath: '.github/workflows/security.yml',
      event: 'pull_request',
    })),
  ];
  const workflowRuns = [
    {
      id: 301,
      check_suite_id: 203,
      head_sha: sha('a'),
      workflow_id: 401,
      path: '.github/workflows/security.yml',
      event: 'pull_request',
      status: 'completed',
      conclusion: 'success',
      repository: { id: 1234 },
      head_repository: { id: 1234 },
    },
  ];
  const context = {
    repositoryId: 1234,
    repositoryFullName: 'RevealUIStudio/revealui',
    pullRequest: 3076,
    headSha: sha('a'),
    headTreeSha: sha('b'),
    baseSha: sha('c'),
    baseTreeSha: sha('d'),
    mergeCandidateTreeSha: sha('e'),
    manifestSha256: digest('f'),
    policyVersion: 'receipt-policy-v1',
    classifierVersion: gates.SECURITY_PATH_CLASSIFIER_VERSION,
    requiredChecks: requiredChecks.map((selector) => {
      const run = [currentCheckRun, ...securityCheckRuns].find(
        (item) => item.name === selector.name && item.app.id === selector.appId,
      );
      if (!run) throw new Error(`missing fixture check ${selector.name}`);
      return {
        ...selector,
        checkRunId: run.id,
        checkSuiteId: run.check_suite.id,
      };
    }),
    minimumIndependentReviews: 1,
    maxReceiptLifetimeMs: 60 * 60_000,
    now,
  };
  const envelope = gates.signReviewReceipt({
    keyId: 'review-controller-2026-01',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    expected: context,
    receipt: {
      schema: gates.REVIEW_RECEIPT_SCHEMA,
      receiptId: `receipt-${digest('1')}`,
      issuedAt: '2026-10-07T11:30:00.000Z',
      expiresAt: '2026-10-07T12:30:00.000Z',
      repository: { id: context.repositoryId, fullName: context.repositoryFullName },
      pullRequest: context.pullRequest,
      head: { sha: context.headSha, treeSha: context.headTreeSha },
      base: { sha: context.baseSha, treeSha: context.baseTreeSha },
      mergeCandidate: { treeSha: context.mergeCandidateTreeSha },
      manifest: { sha256: context.manifestSha256, fileCount: 1 },
      policy: {
        version: context.policyVersion,
        classifierVersion: context.classifierVersion,
      },
      reviews: [
        {
          reviewerId: 'github-user:900',
          system: 'openai-codex-subscription',
          executionId: 'github-review:500',
          revisionSha: context.headSha,
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
      ],
      checks: [
        ...[currentCheckRun, ...securityCheckRuns].map((run) => ({
          name: run.name,
          appId: run.app.id,
          checkRunId: run.id,
          checkSuiteId: run.check_suite.id,
          conclusion: 'success' as const,
          evidenceSha256: gates.reviewReceiptCheckEvidenceSha256({
            name: run.name,
            appId: run.app.id,
            checkRunId: run.id,
            checkSuiteId: run.check_suite.id,
            headSha: run.head_sha,
            status: run.status,
            conclusion: run.conclusion,
            completedAt: run.completed_at,
          }),
        })),
      ],
      decision: 'approve',
    },
  });
  const input = {
    receiptCheckRun: {
      name: 'RevealUI Receipt',
      app: { id: 30 },
      head_sha: context.headSha,
      status: 'completed',
      conclusion: 'success',
      external_id: 'pr-1234-3076',
      output: {
        summary: `Receipt verified by controller.\n\n<!-- revealui-review-receipt:v1 -->\n${gates.canonicalReviewReceiptEnvelope(envelope)}`,
      },
    },
    controllerAppId: 30,
    repositoryId: context.repositoryId,
    repositoryFullName: context.repositoryFullName,
    pullRequest: context.pullRequest,
    headSha: context.headSha,
    headTreeSha: context.headTreeSha,
    baseSha: context.baseSha,
    baseTreeSha: context.baseTreeSha,
    mergeCandidateTreeSha: context.mergeCandidateTreeSha,
    requiredChecks,
    currentCheckRuns: [currentCheckRun, ...securityCheckRuns],
    workflowRuns,
    changedFiles: ['packages/security/src/new.ts'],
    trustedKeys: { 'review-controller-2026-01': publicKey.export({ type: 'spki', format: 'pem' }) },
    policyVersion: context.policyVersion,
    maxLifetimeMs: context.maxReceiptLifetimeMs,
    sensitive: true,
    now,
    ...overrides,
  };
  return {
    input,
    context,
    receiptCheckRun: input.receiptCheckRun,
    currentCheckRuns: input.currentCheckRuns,
  };
}

describe('security review receipt shadow verification', () => {
  it('accepts an exact-head signed receipt from the configured controller and live checks', () => {
    const { input } = fixture();
    expect(verifyReceiptShadow(input)).toMatchObject({ ok: true });
  });

  it('ignores an untrusted same-name Actions check but holds on a newer trusted run', () => {
    const { input } = fixture();
    const forged = {
      ...input.currentCheckRuns.find((run) => run.name === 'Security Gate'),
      id: 900,
      check_suite: { id: 900 },
    };
    expect(
      verifyReceiptShadow({
        ...input,
        currentCheckRuns: [...input.currentCheckRuns, forged],
      }),
    ).toMatchObject({ ok: true });
    expect(
      verifyReceiptShadow({
        ...input,
        workflowRuns: [
          ...input.workflowRuns,
          {
            ...input.workflowRuns[0],
            id: 302,
            check_suite_id: 900,
          },
        ],
        currentCheckRuns: [...input.currentCheckRuns, forged],
      }),
    ).toMatchObject({ ok: false, reason: 'receipt_required_check_selector_not_unique' });
  });

  it('holds when the PR changes workflow definitions or the trusted run disappears', () => {
    const { input } = fixture();
    expect(
      verifyReceiptShadow({
        ...input,
        changedFiles: ['.github/workflows/security.yml'],
      }),
    ).toMatchObject({ ok: false, reason: 'receipt_workflow_provenance_untrusted' });
    expect(
      verifyReceiptShadow({
        ...input,
        workflowRuns: [],
      }),
    ).toMatchObject({ ok: false, reason: 'receipt_required_workflow_run_missing' });
  });

  it.each([
    ['wrong controller App', { controllerAppId: 31 }],
    ['stale base', { baseSha: sha('9') }],
    [
      'failed required check',
      {
        currentCheckRuns: [
          {
            name: 'CI / test',
            app: { id: 20 },
            head_sha: sha('a'),
            status: 'completed',
            conclusion: 'failure',
            id: 101,
            check_suite: { id: 201 },
          },
        ],
      },
    ],
    [
      'a rerun of the same check identity',
      {
        currentCheckRuns: [
          {
            name: 'CI / test',
            app: { id: 20 },
            head_sha: sha('a'),
            status: 'completed',
            conclusion: 'success',
            completed_at: '2026-10-07T11:50:00.000Z',
            id: 101,
            check_suite: { id: 201 },
          },
        ],
      },
    ],
  ])('rejects %s', (_label, overrides) => {
    const { input } = fixture(overrides as Record<string, unknown>);
    expect(verifyReceiptShadow(input).ok).toBe(false);
  });

  it('loads receipt and check evidence from the live API, then rechecks PR refs', () => {
    const { input, context, receiptCheckRun, currentCheckRuns } = fixture();
    let prReads = 0;
    const ghImpl = (args: string[]) => {
      const endpoint = args[1] ?? '';
      if (endpoint.endsWith('/pulls/3076')) {
        prReads++;
        return JSON.stringify({
          state: 'open',
          draft: false,
          mergeable: true,
          merged_at: null,
          merge_commit_sha: sha('e'),
          base: {
            sha: context.baseSha,
            repo: { id: context.repositoryId, full_name: context.repositoryFullName },
          },
          head: { sha: context.headSha, repo: { full_name: context.repositoryFullName } },
        });
      }
      if (endpoint.includes('/commits/')) {
        const commitSha = endpoint.split('/commits/')[1];
        const treeSha = new Map([
          [context.headSha, context.headTreeSha],
          [context.baseSha, context.baseTreeSha],
          [sha('e'), context.mergeCandidateTreeSha],
        ]).get(commitSha);
        if (treeSha) return JSON.stringify({ commit: { tree: { sha: treeSha } } });
      }
      if (endpoint.includes('/check-runs?'))
        return JSON.stringify([{ check_runs: [...currentCheckRuns, receiptCheckRun] }]);
      if (endpoint.includes('/actions/runs?'))
        return JSON.stringify([
          { total_count: input.workflowRuns.length, workflow_runs: input.workflowRuns },
        ]);
      throw new Error(`unexpected endpoint ${endpoint}`);
    };
    const result = evaluateReceiptShadowForPr(
      context.pullRequest,
      context.repositoryFullName,
      ['packages/security/src/new.ts'],
      {
        controllerAppId: 30,
        maxLifetimeMs: 60 * 60_000,
        policyVersion: context.policyVersion,
        trustedKeys: input.trustedKeys,
        requiredChecks: [{ name: 'CI / test', appId: 20 }],
      },
      ghImpl,
      now,
    );
    expect(result, JSON.stringify(result)).toMatchObject({ status: 'verified' });
    expect(prReads).toBe(2);
  });

  it('fails closed when workflow-run evidence is unavailable', () => {
    const { input, context, receiptCheckRun, currentCheckRuns } = fixture();
    const ghImpl = (args: string[]) => {
      const endpoint = args[1] ?? '';
      if (endpoint.endsWith('/pulls/3076'))
        return JSON.stringify({
          state: 'open',
          draft: false,
          mergeable: true,
          merged_at: null,
          merge_commit_sha: sha('e'),
          base: {
            sha: context.baseSha,
            repo: { id: context.repositoryId, full_name: context.repositoryFullName },
          },
          head: { sha: context.headSha, repo: { full_name: context.repositoryFullName } },
        });
      if (endpoint.includes('/commits/')) {
        const commitSha = endpoint.split('/commits/')[1];
        const treeSha = new Map([
          [context.headSha, context.headTreeSha],
          [context.baseSha, context.baseTreeSha],
          [sha('e'), context.mergeCandidateTreeSha],
        ]).get(commitSha);
        if (treeSha) return JSON.stringify({ commit: { tree: { sha: treeSha } } });
      }
      if (endpoint.includes('/check-runs?'))
        return JSON.stringify([{ check_runs: [...currentCheckRuns, receiptCheckRun] }]);
      throw new Error('workflow API unavailable');
    };
    expect(() =>
      evaluateReceiptShadowForPr(
        context.pullRequest,
        context.repositoryFullName,
        ['packages/security/src/new.ts'],
        {
          controllerAppId: 30,
          maxLifetimeMs: 60 * 60_000,
          policyVersion: context.policyVersion,
          trustedKeys: input.trustedKeys,
          requiredChecks: input.requiredChecks,
        },
        ghImpl,
        now,
      ),
    ).toThrow('workflow API unavailable');
  });
});
