import type { ReviewControllerDatabase } from '@revealui/db/review-controller';
import {
  type ReceiptAuthorizationRequest,
  signReceiptAuthorization,
} from '@revealui/security/review-receipt';
import { sql } from 'drizzle-orm';

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
    await this.db.execute(
      sql`SELECT generation FROM review_controller_receipt_authorizations LIMIT 0`,
    );
  }

  async begin(repositoryId: number, pullRequest: number): Promise<number> {
    const result = await this.db.execute(sql`
      INSERT INTO review_controller_receipt_authorizations (repository_id, pull_request, generation, state)
      VALUES (${repositoryId}, ${pullRequest}, 1, 'pending')
      ON CONFLICT (repository_id, pull_request) DO UPDATE SET
        generation = review_controller_receipt_authorizations.generation + 1,
        state = 'pending', receipt_id = NULL, envelope_sha256 = NULL, expires_at = NULL
      WHERE review_controller_receipt_authorizations.generation < 9007199254740991
      RETURNING generation
    `);
    const generation = Number(result.rows[0]?.generation);
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
    const result = await this.db.execute(sql`
      UPDATE review_controller_receipt_authorizations SET state = 'approved',
        receipt_id = ${input.receiptId}, envelope_sha256 = ${input.envelopeSha256}, expires_at = ${input.expiresAt}
      WHERE repository_id = ${input.repositoryId} AND pull_request = ${input.pullRequest}
        AND generation = ${input.generation} AND state = 'pending' AND ${input.expiresAt} > now()
        AND EXISTS (SELECT 1 FROM review_controller_signed_receipts r
          WHERE r.receipt_id = ${input.receiptId} AND r.repository_id = ${input.repositoryId}
            AND r.pull_request = ${input.pullRequest} AND r.envelope_sha256 = ${input.envelopeSha256}
            AND r.expires_at = ${input.expiresAt})
      RETURNING generation
    `);
    return result.rows.length === 1;
  }

  async revoke(repositoryId: number, pullRequest: number, generation: number): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE review_controller_receipt_authorizations SET state = 'revoked',
        receipt_id = NULL, envelope_sha256 = NULL, expires_at = NULL
      WHERE repository_id = ${repositoryId} AND pull_request = ${pullRequest}
        AND generation = ${generation} AND state = 'pending'
      RETURNING generation
    `);
    return result.rows.length === 1;
  }

  async expire(repositoryId: number, pullRequest: number, receiptId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE review_controller_receipt_authorizations SET generation = generation + 1,
        state = 'expired', envelope_sha256 = NULL
      WHERE repository_id = ${repositoryId} AND pull_request = ${pullRequest}
        AND receipt_id = ${receiptId} AND state = 'approved' AND expires_at <= now()
        AND generation < 9007199254740991
      RETURNING generation
    `);
    return result.rows.length === 1;
  }

  async attest(input: {
    request: ReceiptAuthorizationRequest;
    keyId: string;
    privateKey: string | Buffer;
    now?: Date;
  }) {
    const result = await this.db.execute(sql`
      SELECT generation, state, envelope_sha256, expires_at FROM review_controller_receipt_authorizations
      WHERE repository_id = ${input.request.repositoryId} AND pull_request = ${input.request.pullRequest}
    `);
    const row = result.rows[0];
    const now = input.now ?? new Date();
    const generation = row ? Number(row.generation) : 0;
    const expiresAt = row?.expires_at
      ? row.expires_at instanceof Date
        ? row.expires_at
        : new Date(String(row.expires_at))
      : undefined;
    const authorized =
      row?.state === 'approved' &&
      row.envelope_sha256 === input.request.envelopeSha256 &&
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
