import { and, eq, exists, gt, lt, lte, sql } from '@revealui/db/orm';
import {
  reviewControllerReceiptAuthorizations as authorizations,
  type ReviewControllerDatabase,
  reviewControllerSignedReceipts as receipts,
} from '@revealui/db/review-controller';
import {
  type ReceiptAuthorizationRequest,
  signReceiptAuthorization,
} from '@revealui/security/review-receipt';

export interface ReceiptAuthority {
  begin(repositoryId: number, pullRequest: number): Promise<number>;
  approve(input: {
    repositoryId: number;
    pullRequest: number;
    generation: number;
    receiptId: string;
    envelopeSha256: string;
    expiresAt: Date;
  }): Promise<boolean>;
  revoke(repositoryId: number, pullRequest: number, generation: number): Promise<boolean>;
  expire(repositoryId: number, pullRequest: number, receiptId: string): Promise<boolean>;
}

/** Mutable authorization state is separate from immutable signed evidence.
 * Each evaluation first invalidates the previous generation. Only the current
 * pending generation can authorize its exact stored receipt digest.
 */
export class PostgresReceiptAuthority implements ReceiptAuthority {
  constructor(private readonly db: ReviewControllerDatabase) {}

  async ready(): Promise<void> {
    await this.db.select({ generation: authorizations.generation }).from(authorizations).limit(0);
  }

  async begin(repositoryId: number, pullRequest: number): Promise<number> {
    const result = await this.db
      .insert(authorizations)
      .values({
        repositoryId,
        pullRequest,
        generation: 1,
        state: 'pending',
      })
      .onConflictDoUpdate({
        target: [authorizations.repositoryId, authorizations.pullRequest],
        set: {
          generation: sql`${authorizations.generation} + 1`,
          state: 'pending',
          receiptId: null,
          envelopeSha256: null,
          expiresAt: null,
        },
        setWhere: lt(authorizations.generation, Number.MAX_SAFE_INTEGER),
      })
      .returning({ generation: authorizations.generation });
    const generation = Number(result[0]?.generation);
    if (!Number.isSafeInteger(generation) || generation <= 0)
      throw new Error('receipt_authorization_generation_unavailable');
    return generation;
  }

  async approve(input: {
    repositoryId: number;
    pullRequest: number;
    generation: number;
    receiptId: string;
    envelopeSha256: string;
    expiresAt: Date;
  }): Promise<boolean> {
    const result = await this.db
      .update(authorizations)
      .set({
        state: 'approved',
        receiptId: input.receiptId,
        envelopeSha256: input.envelopeSha256,
        expiresAt: input.expiresAt,
      })
      .where(
        and(
          eq(authorizations.repositoryId, input.repositoryId),
          eq(authorizations.pullRequest, input.pullRequest),
          eq(authorizations.generation, input.generation),
          eq(authorizations.state, 'pending'),
          gt(sql`${input.expiresAt.toISOString()}::timestamptz`, sql`now()`),
          exists(
            this.db
              .select({ receiptId: receipts.receiptId })
              .from(receipts)
              .where(
                and(
                  eq(receipts.receiptId, input.receiptId),
                  eq(receipts.repositoryId, input.repositoryId),
                  eq(receipts.pullRequest, input.pullRequest),
                  eq(receipts.envelopeSha256, input.envelopeSha256),
                  eq(receipts.expiresAt, input.expiresAt),
                ),
              ),
          ),
        ),
      )
      .returning({ generation: authorizations.generation });
    return result.length === 1;
  }

  async revoke(repositoryId: number, pullRequest: number, generation: number): Promise<boolean> {
    const result = await this.db
      .update(authorizations)
      .set({
        state: 'revoked',
        receiptId: null,
        envelopeSha256: null,
        expiresAt: null,
      })
      .where(
        and(
          eq(authorizations.repositoryId, repositoryId),
          eq(authorizations.pullRequest, pullRequest),
          eq(authorizations.generation, generation),
          eq(authorizations.state, 'pending'),
        ),
      )
      .returning({ generation: authorizations.generation });
    return result.length === 1;
  }

  async expire(repositoryId: number, pullRequest: number, receiptId: string): Promise<boolean> {
    const result = await this.db
      .update(authorizations)
      .set({
        generation: sql`${authorizations.generation} + 1`,
        state: 'expired',
        envelopeSha256: null,
      })
      .where(
        and(
          eq(authorizations.repositoryId, repositoryId),
          eq(authorizations.pullRequest, pullRequest),
          eq(authorizations.receiptId, receiptId),
          eq(authorizations.state, 'approved'),
          lte(authorizations.expiresAt, sql`now()`),
          lt(authorizations.generation, Number.MAX_SAFE_INTEGER),
        ),
      )
      .returning({ generation: authorizations.generation });
    return result.length === 1;
  }

  async attest(input: {
    request: ReceiptAuthorizationRequest;
    keyId: string;
    privateKey: string | Buffer;
    now?: Date;
  }) {
    const result = await this.db
      .select({
        generation: authorizations.generation,
        state: authorizations.state,
        envelopeSha256: authorizations.envelopeSha256,
        expiresAt: authorizations.expiresAt,
      })
      .from(authorizations)
      .where(
        and(
          eq(authorizations.repositoryId, input.request.repositoryId),
          eq(authorizations.pullRequest, input.request.pullRequest),
        ),
      );
    const row = result[0];
    const now = input.now ?? new Date();
    const generation = row ? Number(row.generation) : 0;
    const expiresAt = row?.expiresAt
      ? row.expiresAt instanceof Date
        ? row.expiresAt
        : new Date(String(row.expiresAt))
      : undefined;
    const authorized =
      row?.state === 'approved' &&
      row.envelopeSha256 === input.request.envelopeSha256 &&
      Boolean(expiresAt && expiresAt.getTime() > now.getTime());
    return signReceiptAuthorization({
      request: input.request,
      generation,
      authorized,
      keyId: input.keyId,
      privateKey: input.privateKey,
      now,
      receiptExpiresAt: expiresAt,
    });
  }
}
