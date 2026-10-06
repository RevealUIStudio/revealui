import { generateKeyPairSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import {
  canonicalReviewReceiptEnvelope,
  REVIEW_RECEIPT_SCHEMA,
  type ReviewReceipt,
  signReviewReceipt,
} from '@revealui/harnesses/gates';
import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresSignedReceiptStore } from './receipt-store.js';

describe('PostgresSignedReceiptStore', () => {
  let db: PGlite;
  let store: PostgresSignedReceiptStore;
  let signed: ReturnType<typeof signReviewReceipt>;

  beforeEach(async () => {
    db = new PGlite();
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0001_webhook_inbox.sql'),
      'utf8',
    );
    await db.exec(migration);
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        const result = await db.query(sql, values);
        return { rows: result.rows, rowCount: result.affectedRows ?? null };
      },
    } as unknown as Pool;
    store = new PostgresSignedReceiptStore(pool);
    const { privateKey } = generateKeyPairSync('ed25519');
    signed = signReviewReceipt({
      keyId: 'controller-key-1',
      receipt: receipt(),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      expected: {
        repositoryId: 1234,
        repositoryFullName: 'RevealUIStudio/revealui',
        pullRequest: 3054,
        headSha: 'a'.repeat(40),
        headTreeSha: 'b'.repeat(40),
        baseSha: 'c'.repeat(40),
        baseTreeSha: 'd'.repeat(40),
        mergeCandidateTreeSha: 'e'.repeat(40),
        manifestSha256: 'f'.repeat(64),
        policyVersion: 'policy-1',
        classifierVersion: 'classifier-1',
        requiredChecks: [{ name: 'CI', appId: 77, checkRunId: 101, checkSuiteId: 201 }],
        minimumIndependentReviews: 1,
        maxReceiptLifetimeMs: 6 * 60 * 60 * 1000,
        now: new Date('2026-10-06T12:00:00.000Z'),
      },
    });
  });

  afterEach(async () => {
    await db.close();
  });

  it('appends an immutable canonical receipt and safely retries identical bytes', async () => {
    const first = await store.append(signed);
    const second = await store.append(signed);
    expect(second).toEqual(first);
    expect(await store.read('receipt-1')).toBe(canonicalReviewReceiptEnvelope(signed));
    await expect(
      db.query("UPDATE review_controller_signed_receipts SET key_id = 'changed'"),
    ).rejects.toThrow('signed review receipts are append-only');
    await expect(db.query('DELETE FROM review_controller_signed_receipts')).rejects.toThrow(
      'signed review receipts are append-only',
    );
  });

  it('rejects receipt ID reuse for different signed bytes', async () => {
    await store.append(signed);
    const changed = {
      ...signed,
      signature: `${signed.signature.slice(0, -4)}AAAA`,
    };
    await expect(store.append(changed)).rejects.toThrow('receipt_id_conflict');
  });

  it('validates receipt IDs before querying storage', async () => {
    await expect(store.read('receipt/1')).rejects.toThrow('invalid_receipt_id');
  });
});

function receipt(): ReviewReceipt {
  const sha = (digit: string) => digit.repeat(40);
  const digest = (digit: string) => digit.repeat(64);
  return {
    schema: REVIEW_RECEIPT_SCHEMA,
    receiptId: 'receipt-1',
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
        reviewerId: 'reviewer-1',
        system: 'review-service',
        executionId: 'execution-1',
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
  };
}
