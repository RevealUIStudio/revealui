import { createHash } from 'node:crypto';
import {
  type ReviewControllerDatabase,
  reviewControllerSignedReceipts,
} from '@revealui/db/review-controller';
import {
  canonicalReviewReceiptEnvelope,
  type ReviewReceiptEnvelope,
} from '@revealui/security/review-receipt';
import { eq } from 'drizzle-orm';

export interface SignedReceiptStore {
  ready(): Promise<void>;
  append(envelope: ReviewReceiptEnvelope): Promise<{ receiptId: string; sha256: string }>;
  read(receiptId: string): Promise<string | null>;
}

/** Stores signed receipts as immutable evidence; consumers still verify signatures before use. */
export class PostgresSignedReceiptStore implements SignedReceiptStore {
  constructor(private readonly db: ReviewControllerDatabase) {}

  async ready(): Promise<void> {
    await this.db
      .select({ receiptId: reviewControllerSignedReceipts.receiptId })
      .from(reviewControllerSignedReceipts)
      .limit(0);
  }

  async append(envelope: ReviewReceiptEnvelope): Promise<{ receiptId: string; sha256: string }> {
    const receipt = envelope.receipt;
    const canonical = canonicalReviewReceiptEnvelope(envelope);
    const sha256 = createHash('sha256').update(canonical, 'utf8').digest('hex');
    await this.db
      .insert(reviewControllerSignedReceipts)
      .values({
        receiptId: receipt.receiptId,
        repositoryId: receipt.repository.id,
        pullRequest: receipt.pullRequest,
        headSha: receipt.head.sha,
        baseSha: receipt.base.sha,
        candidateTreeSha: receipt.mergeCandidate.treeSha,
        policyVersion: receipt.policy.version,
        keyId: envelope.keyId,
        envelopeSha256: sha256,
        canonicalEnvelope: canonical,
        issuedAt: new Date(receipt.issuedAt),
        expiresAt: new Date(receipt.expiresAt),
      })
      .onConflictDoNothing();
    const [stored] = await this.db
      .select({ canonicalEnvelope: reviewControllerSignedReceipts.canonicalEnvelope })
      .from(reviewControllerSignedReceipts)
      .where(eq(reviewControllerSignedReceipts.receiptId, receipt.receiptId))
      .limit(1);
    if (stored?.canonicalEnvelope !== canonical) throw new Error('receipt_id_conflict');
    return { receiptId: receipt.receiptId, sha256 };
  }

  async read(receiptId: string): Promise<string | null> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(receiptId)) throw new Error('invalid_receipt_id');
    const [stored] = await this.db
      .select({ canonicalEnvelope: reviewControllerSignedReceipts.canonicalEnvelope })
      .from(reviewControllerSignedReceipts)
      .where(eq(reviewControllerSignedReceipts.receiptId, receiptId))
      .limit(1);
    return stored?.canonicalEnvelope ?? null;
  }
}
