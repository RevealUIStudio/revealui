import { createHash } from 'node:crypto';
import {
  canonicalReviewReceiptEnvelope,
  REVIEW_RECEIPT_SCHEMA,
  type ReviewReceiptEnvelope,
} from '@revealui/security/review-receipt';
import { describe, expect, it, vi } from 'vitest';
import type { GitHubAppClient } from './github-app.js';
import { persistReceiptThenPublishCheck } from './receipt-publisher.js';
import type { SignedReceiptStore } from './receipt-store.js';

const sha = (letter: string) => letter.repeat(40);
const digest = (letter: string) => letter.repeat(64);
const envelope: ReviewReceiptEnvelope = {
  keyId: 'controller-key-1',
  signature: 'signed-envelope',
  receipt: {
    schema: REVIEW_RECEIPT_SCHEMA,
    receiptId: 'receipt-123',
    issuedAt: '2026-10-06T12:00:00.000Z',
    expiresAt: '2026-10-06T18:00:00.000Z',
    repository: { id: 1234, fullName: 'RevealUIStudio/revealui' },
    pullRequest: 3054,
    head: { sha: sha('a'), treeSha: sha('b') },
    base: { sha: sha('c'), treeSha: sha('d') },
    mergeCandidate: { treeSha: sha('e') },
    manifest: { sha256: digest('f'), fileCount: 0 },
    policy: { version: 'policy-1', classifierVersion: 'classifier-1' },
    reviews: [
      {
        reviewerId: 'github-user:900',
        system: 'openai-codex-subscription',
        executionId: 'github-review:500',
        revisionSha: sha('a'),
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
    ],
    decision: 'approve',
  },
};

describe('persistReceiptThenPublishCheck', () => {
  it('stores and verifies the immutable envelope before publishing the success check', async () => {
    const events: string[] = [];
    const sha256 = createHash('sha256')
      .update(canonicalReviewReceiptEnvelope(envelope), 'utf8')
      .digest('hex');
    const store: SignedReceiptStore = {
      ready: async () => undefined,
      read: async () => null,
      append: vi.fn(async () => {
        events.push('append');
        return { receiptId: envelope.receipt.receiptId, sha256 };
      }),
    };
    const github: Pick<GitHubAppClient, 'upsertReceiptCheckRun'> = {
      upsertReceiptCheckRun: vi.fn(async (input) => {
        events.push(`publish:${input.eligible}`);
        return {
          id: 800,
          name: 'RevealUI Receipt' as const,
          head_sha: envelope.receipt.head.sha,
          status: 'completed' as const,
          conclusion: 'success' as const,
          external_id: 'pr-1234-3054',
        };
      }),
    };
    await expect(
      persistReceiptThenPublishCheck({
        envelope,
        store,
        github,
      }),
    ).resolves.toMatchObject({
      receiptId: 'receipt-123',
      envelopeSha256: sha256,
      checkRun: { id: 800, conclusion: 'success' },
    });
    expect(events).toEqual(['append', 'publish:true']);
    expect(github.upsertReceiptCheckRun).toHaveBeenCalledWith({
      headSha: envelope.receipt.head.sha,
      externalId: 'pr-1234-3054',
      eligible: true,
    });
  });

  it('never publishes a success check when durable receipt storage fails', async () => {
    const github: Pick<GitHubAppClient, 'upsertReceiptCheckRun'> = {
      upsertReceiptCheckRun: vi.fn(),
    };
    await expect(
      persistReceiptThenPublishCheck({
        envelope,
        store: {
          ready: async () => undefined,
          read: async () => null,
          append: vi.fn(async () => {
            throw new Error('database unavailable');
          }),
        },
        github,
      }),
    ).rejects.toThrow('database unavailable');
    expect(github.upsertReceiptCheckRun).not.toHaveBeenCalled();
  });
});
