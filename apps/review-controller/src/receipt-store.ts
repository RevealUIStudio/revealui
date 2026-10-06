import { createHash } from 'node:crypto';
import {
  canonicalReviewReceiptEnvelope,
  type ReviewReceiptEnvelope,
} from '@revealui/harnesses/gates';
import type { Pool } from 'pg';

export interface SignedReceiptStore {
  ready(): Promise<void>;
  append(envelope: ReviewReceiptEnvelope): Promise<{ receiptId: string; sha256: string }>;
  read(receiptId: string): Promise<string | null>;
}

/** Stores signed receipts as immutable evidence; consumers still verify signatures before use. */
export class PostgresSignedReceiptStore implements SignedReceiptStore {
  constructor(private readonly pool: Pool) {}

  async ready(): Promise<void> {
    await this.pool.query('SELECT receipt_id FROM review_controller_signed_receipts LIMIT 0');
  }

  async append(envelope: ReviewReceiptEnvelope): Promise<{ receiptId: string; sha256: string }> {
    const receipt = envelope.receipt;
    const canonical = canonicalReviewReceiptEnvelope(envelope);
    const sha256 = createHash('sha256').update(canonical, 'utf8').digest('hex');
    await this.pool.query(
      `INSERT INTO review_controller_signed_receipts
        (receipt_id, repository_id, pull_request, head_sha, base_sha, candidate_tree_sha,
         policy_version, key_id, envelope_sha256, canonical_envelope, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (receipt_id) DO NOTHING`,
      [
        receipt.receiptId,
        receipt.repository.id,
        receipt.pullRequest,
        receipt.head.sha,
        receipt.base.sha,
        receipt.mergeCandidate.treeSha,
        receipt.policy.version,
        envelope.keyId,
        sha256,
        canonical,
        receipt.issuedAt,
        receipt.expiresAt,
      ],
    );
    const result = await this.pool.query<{ canonical_envelope: string }>(
      'SELECT canonical_envelope FROM review_controller_signed_receipts WHERE receipt_id = $1',
      [receipt.receiptId],
    );
    if (result.rows[0]?.canonical_envelope !== canonical) throw new Error('receipt_id_conflict');
    return { receiptId: receipt.receiptId, sha256 };
  }

  async read(receiptId: string): Promise<string | null> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(receiptId)) throw new Error('invalid_receipt_id');
    const result = await this.pool.query<{ canonical_envelope: string }>(
      'SELECT canonical_envelope FROM review_controller_signed_receipts WHERE receipt_id = $1',
      [receiptId],
    );
    return result.rows[0]?.canonical_envelope ?? null;
  }
}
