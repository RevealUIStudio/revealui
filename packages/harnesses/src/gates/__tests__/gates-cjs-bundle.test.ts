import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const bundlePath = path.join(repoRoot, 'packages/harnesses/dist/gates/index.cjs');

interface ReceiptCheck {
  name: string;
  appId: number;
  checkRunId: number;
  checkSuiteId: number;
  conclusion: 'success';
  evidenceSha256: string;
}

interface ReviewReceipt {
  schema: string;
  receiptId: string;
  issuedAt: string;
  expiresAt: string;
  repository: { id: number; fullName: string };
  pullRequest: number;
  head: { sha: string; treeSha: string };
  base: { sha: string; treeSha: string };
  mergeCandidate: { treeSha: string };
  manifest: { sha256: string; fileCount: number };
  policy: { version: string; classifierVersion: string };
  reviews: Array<{
    reviewerId: string;
    system: string;
    executionId: string;
    revisionSha: string;
    verdict: 'approve';
    criticalFindings: number;
    highFindings: number;
  }>;
  checks: ReceiptCheck[];
  decision: 'approve';
}

interface ReviewReceiptContext {
  repositoryId: number;
  repositoryFullName: string;
  pullRequest: number;
  headSha: string;
  headTreeSha: string;
  baseSha: string;
  baseTreeSha: string;
  mergeCandidateTreeSha: string;
  manifestSha256: string;
  policyVersion: string;
  classifierVersion: string;
  requiredChecks: Array<{
    name: string;
    appId: number;
    checkRunId: number;
    checkSuiteId: number;
  }>;
  minimumIndependentReviews: number;
  maxReceiptLifetimeMs: number;
  now: Date;
}

interface ReviewReceiptEnvelope {
  keyId: string;
  receipt: ReviewReceipt;
  signature: string;
}

interface GatesBundle {
  REVIEW_RECEIPT_SCHEMA: string;
  signReviewReceipt: (input: {
    keyId: string;
    receipt: ReviewReceipt;
    privateKey: string;
    expected: ReviewReceiptContext;
  }) => ReviewReceiptEnvelope;
  verifyReviewReceipt: (input: {
    envelope: ReviewReceiptEnvelope;
    trustedKeys: Record<string, string>;
    expected: ReviewReceiptContext;
  }) => { ok: boolean; reason?: string; receiptId?: string };
}

function buildGatesBundle(): void {
  execFileSync(
    'pnpm',
    ['--filter', '@revealui/harnesses', 'exec', 'tsup', '--config', 'tsup.gates-cjs.ts'],
    { cwd: repoRoot, stdio: 'inherit' },
  );
}

describe('gates CJS bundle', () => {
  it('has no runtime require of @revealui/security and rejects a bad signature', () => {
    buildGatesBundle();
    const source = readFileSync(bundlePath, 'utf8');
    expect(source.includes('require("@revealui/security')).toBe(false);
    expect(source.includes("require('@revealui/security")).toBe(false);
    expect(source.includes('@revealui/security')).toBe(false);

    const gates = require(bundlePath) as GatesBundle;
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const sha = (char: string): string => char.repeat(40);
    const digest = (char: string): string => char.repeat(64);
    const expected: ReviewReceiptContext = {
      repositoryId: 1234,
      repositoryFullName: 'example/repo',
      pullRequest: 3054,
      headSha: sha('a'),
      headTreeSha: sha('b'),
      baseSha: sha('c'),
      baseTreeSha: sha('d'),
      mergeCandidateTreeSha: sha('e'),
      manifestSha256: digest('f'),
      policyVersion: 'review-policy-1',
      classifierVersion: 'security-paths-1',
      requiredChecks: [
        { name: 'CI', appId: 77, checkRunId: 101, checkSuiteId: 201 },
        { name: 'Security', appId: 77, checkRunId: 102, checkSuiteId: 202 },
      ],
      minimumIndependentReviews: 2,
      maxReceiptLifetimeMs: 6 * 60 * 60 * 1000,
      now: new Date('2026-10-06T12:00:00.000Z'),
    };
    const receipt: ReviewReceipt = {
      schema: gates.REVIEW_RECEIPT_SCHEMA,
      receiptId: 'receipt-3054-1',
      issuedAt: '2026-10-06T11:00:00.000Z',
      expiresAt: '2026-10-06T17:00:00.000Z',
      repository: { id: expected.repositoryId, fullName: expected.repositoryFullName },
      pullRequest: expected.pullRequest,
      head: { sha: expected.headSha, treeSha: expected.headTreeSha },
      base: { sha: expected.baseSha, treeSha: expected.baseTreeSha },
      mergeCandidate: { treeSha: expected.mergeCandidateTreeSha },
      manifest: { sha256: expected.manifestSha256, fileCount: 4 },
      policy: { version: expected.policyVersion, classifierVersion: expected.classifierVersion },
      reviews: [
        {
          reviewerId: 'reviewer-a',
          system: 'review-model-a',
          executionId: 'execution-a',
          revisionSha: expected.headSha,
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
        {
          reviewerId: 'reviewer-b',
          system: 'review-model-b',
          executionId: 'execution-b',
          revisionSha: expected.headSha,
          verdict: 'approve',
          criticalFindings: 0,
          highFindings: 0,
        },
      ],
      checks: [
        {
          name: 'CI',
          appId: 77,
          checkRunId: 101,
          checkSuiteId: 201,
          conclusion: 'success',
          evidenceSha256: digest('1'),
        },
        {
          name: 'Security',
          appId: 77,
          checkRunId: 102,
          checkSuiteId: 202,
          conclusion: 'success',
          evidenceSha256: digest('2'),
        },
      ],
      decision: 'approve',
    };
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const signed = gates.signReviewReceipt({
      keyId: 'controller-test',
      receipt,
      privateKey: privatePem,
      expected,
    });
    const trustedKeys = { 'controller-test': publicPem };
    expect(gates.verifyReviewReceipt({ envelope: signed, trustedKeys, expected })).toEqual({
      ok: true,
      receiptId: 'receipt-3054-1',
    });
    const badSignature = Buffer.alloc(64).toString('base64');
    expect(badSignature === signed.signature).toBe(false);
    expect(
      gates.verifyReviewReceipt({
        envelope: { ...signed, signature: badSignature },
        trustedKeys,
        expected,
      }),
    ).toEqual({ ok: false, reason: 'invalid-signature' });
  }, 120_000);
});
