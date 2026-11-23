import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { gateReceiptExpiryDate, gateReceiptObjectPath, signGateReceipt } from './gate-receipt.js';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = path.join(repoRoot, 'packages/harnesses/dist/gates/index.cjs');
const gatePath = path.join(repoRoot, 'scripts/validate/security-review-gate.cjs');
let gate: GateModule | undefined;

interface GateDecision {
  action: string;
  kind: string;
  reason?: string;
}
interface GateModule {
  reviewReceiptObjectPath: (repo: string, pr: number, head: string) => string;
  buildReviewReceiptRequest: (
    repo: string,
    pr: number,
    head: string,
    env: NodeJS.ProcessEnv,
  ) => { enabled: boolean; path: string };
  fetchReviewReceipt: (
    repo: string,
    pr: number,
    head: string,
    gh: (args: string[], token: string) => string,
    env: NodeJS.ProcessEnv,
  ) => { body: string; reason: string };
  verifyPrOwnerRecord: (
    data: { author: { login: string }; headRefOid: string },
    pr: number,
    repo: string,
    discussion: { comments: unknown[]; reviews: unknown[] },
    allowedSigners: string,
    verifyImpl: undefined,
    receiptBody: string,
  ) => GateDecision;
}

const repository = 'RevealUIStudio/revealui';
const pullRequest = 3155;
const head = 'a'.repeat(40);
const now = new Date('2026-11-23T12:00:00.000Z');
const { privateKey } = generateKeyPairSync('ed25519');
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

beforeAll(() => {
  if (!existsSync(bundle)) {
    try {
      execFileSync(
        'pnpm',
        ['--filter', '@revealui/harnesses', 'exec', 'tsup', '--config', 'tsup.gates-cjs.ts'],
        { cwd: repoRoot, stdio: 'inherit' },
      );
    } catch {
      return;
    }
  }
  if (!existsSync(bundle)) return;
  gate = require(gatePath) as GateModule;
});

function reviewGate(): GateModule {
  if (!gate) throw new Error('review gate bundle unavailable');
  return gate;
}

function signedReceipt() {
  return signGateReceipt({
    repositoryFullName: repository,
    pullRequest,
    head,
    expiresAt: new Date('2026-11-24T18:00:00.000Z'),
    privateKeyPem,
    now,
  });
}

function decisionFor(
  receiptBody: string,
  expectedHead: string,
  expectedPr: number,
  expectedRepo: string,
) {
  return reviewGate().verifyPrOwnerRecord(
    { author: { login: 'review-controller' }, headRefOid: expectedHead },
    expectedPr,
    expectedRepo,
    { comments: [], reviews: [] },
    signedReceipt().allowedSigners,
    undefined,
    receiptBody,
  );
}

describe('controller gate receipt', () => {
  it('uses the review gate object path for the exact head', () => {
    expect(gateReceiptObjectPath(repository, pullRequest, head)).toBe(
      `receipts/RevealUIStudio/revealui/${pullRequest}/${head}`,
    );
    if (gate) {
      expect(gate.reviewReceiptObjectPath(repository, pullRequest, head)).toBe(
        gateReceiptObjectPath(repository, pullRequest, head),
      );
    }
  });

  it('signs a same-day receipt through the next UTC date and keeps a later date', () => {
    expect(gateReceiptExpiryDate(new Date('2026-11-23T18:00:00.000Z'), now)).toBe('2026-11-24');
    expect(gateReceiptExpiryDate(new Date('2026-11-25T01:00:00.000Z'), now)).toBe('2026-11-25');
    expect(() => gateReceiptExpiryDate(new Date('2026-11-23T11:00:00.000Z'), now)).toThrow(
      'gate_receipt_expired',
    );
  });

  it('round-trips a controller receipt through the review gate loader for the exact head', (context) => {
    if (!gate) {
      context.skip();
      return;
    }
    const receipt = signedReceipt();
    const env = {
      REVIEW_RECEIPT_REPO: repository,
      REVIEW_RECEIPT_REF: 'receipts',
      REVIEW_RECEIPT_SIGNERS: receipt.allowedSigners,
    };
    const request = gate.buildReviewReceiptRequest(repository, pullRequest, head, env);
    expect(request.enabled).toBe(true);
    expect(request.path).toBe(
      `repos/${repository}/contents/${receipt.path}?ref=${encodeURIComponent('receipts')}`,
    );
    const loaded = gate.fetchReviewReceipt(
      repository,
      pullRequest,
      head,
      (args) => {
        expect(args[3]).toBe(request.path);
        return receipt.body;
      },
      env,
    );
    expect(loaded.reason).toBe('');
    expect(decisionFor(loaded.body, head, pullRequest, repository)).toMatchObject({
      action: 'clear',
      kind: 'review-receipt',
    });
  });

  it.each([
    ['head', 'b'.repeat(40), pullRequest, repository],
    ['pull request', head, 3156, repository],
    ['repository', head, pullRequest, 'RevealUIStudio/other'],
  ] as const)(
    'refuses a receipt bound to a different %s',
    (_label, expectedHead, expectedPr, expectedRepo, context) => {
      if (!gate) {
        context.skip();
        return;
      }
      const receipt = signedReceipt();
      expect(decisionFor(receipt.body, expectedHead, expectedPr, expectedRepo)).toMatchObject({
        action: 'hold',
        reason: 'wrong-context',
      });
      const env = {
        REVIEW_RECEIPT_REPO: repository,
        REVIEW_RECEIPT_REF: 'receipts',
        REVIEW_RECEIPT_SIGNERS: receipt.allowedSigners,
      };
      const loaded = reviewGate().fetchReviewReceipt(
        expectedRepo,
        expectedPr,
        expectedHead,
        (args) => {
          const request = reviewGate().buildReviewReceiptRequest(
            repository,
            pullRequest,
            head,
            env,
          );
          if (args[3] !== request.path) throw new Error('missing');
          return receipt.body;
        },
        env,
      );
      expect(loaded.body).toBe('');
      expect(loaded.reason).toBe('missing-review-receipt');
    },
  );
});
