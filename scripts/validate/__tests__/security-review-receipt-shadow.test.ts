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
    requiredChecks: [{ name: 'CI / test', appId: 20, checkRunId: 101, checkSuiteId: 201 }],
    minimumIndependentReviews: 2,
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
          reviewerId: 'reviewer-a',
          system: 'system-a',
          executionId: 'execution-a',
          revisionSha: context.headSha,
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
        {
          reviewerId: 'reviewer-b',
          system: 'system-b',
          executionId: 'execution-b',
          revisionSha: context.headSha,
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
      ],
      checks: [
        {
          name: 'CI / test',
          appId: 20,
          checkRunId: 101,
          checkSuiteId: 201,
          conclusion: 'success',
          evidenceSha256: gates.reviewReceiptCheckEvidenceSha256({
            name: currentCheckRun.name,
            appId: currentCheckRun.app.id,
            checkRunId: currentCheckRun.id,
            checkSuiteId: currentCheckRun.check_suite.id,
            headSha: currentCheckRun.head_sha,
            status: currentCheckRun.status,
            conclusion: currentCheckRun.conclusion,
            completedAt: currentCheckRun.completed_at,
          }),
        },
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
    requiredChecks: [{ name: 'CI / test', appId: 20 }],
    currentCheckRuns: [currentCheckRun],
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
});
