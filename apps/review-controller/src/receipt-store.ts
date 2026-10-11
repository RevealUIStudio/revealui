import { createHash } from 'node:crypto';
import {
  type ReviewControllerDatabase,
  reviewControllerSignedReceipts,
} from '@revealui/db/review-controller';
import {
  canonicalReviewReceiptEnvelope,
  type ReviewReceiptEnvelope,
} from '@revealui/security/review-receipt';
import { desc, eq } from 'drizzle-orm';

export interface SignedReceiptStore {
  ready(): Promise<void>;
  append(envelope: ReviewReceiptEnvelope): Promise<{ receiptId: string; sha256: string }>;
  read(receiptId: string): Promise<string | null>;
  listLatest(repositoryId: number): Promise<StoredReceipt[]>;
}

export interface StoredReceipt {
  receiptId: string;
  repositoryId: number;
  pullRequest: number;
  headSha: string;
  baseSha: string;
  expiresAt: Date;
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

  async listLatest(repositoryId: number): Promise<StoredReceipt[]> {
    if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0)
      throw new Error('invalid receipt repository ID');
    const rows = await this.db
      .selectDistinctOn(
        [reviewControllerSignedReceipts.repositoryId, reviewControllerSignedReceipts.pullRequest],
        {
          receiptId: reviewControllerSignedReceipts.receiptId,
          repositoryId: reviewControllerSignedReceipts.repositoryId,
          pullRequest: reviewControllerSignedReceipts.pullRequest,
          headSha: reviewControllerSignedReceipts.headSha,
          baseSha: reviewControllerSignedReceipts.baseSha,
          expiresAt: reviewControllerSignedReceipts.expiresAt,
        },
      )
      .from(reviewControllerSignedReceipts)
      .where(eq(reviewControllerSignedReceipts.repositoryId, repositoryId))
      .orderBy(
        reviewControllerSignedReceipts.repositoryId,
        reviewControllerSignedReceipts.pullRequest,
        desc(reviewControllerSignedReceipts.issuedAt),
        desc(reviewControllerSignedReceipts.storedAt),
        desc(reviewControllerSignedReceipts.receiptId),
      );
    return rows;
  }
}
