import {
  type ReviewControllerDatabase,
  reviewControllerShadowObservations,
  reviewControllerWebhookInbox,
} from '@revealui/db/review-controller';
import { and, asc, eq, gte, lte, or, sql } from 'drizzle-orm';
import type { AcceptedWebhook } from './webhook.js';

export const MAX_WEBHOOK_ATTEMPTS = 12;

export interface ClaimedWebhook {
  deliveryId: string;
  eventName: string;
  installationId: number;
  repositoryId: number;
  receivedAt: Date;
  payload: Record<string, unknown>;
  attempts: number;
  leaseToken: string;
}

export interface WebhookInbox {
  enqueue(webhook: AcceptedWebhook): Promise<{ inserted: boolean }>;
  scheduleReceiptExpiration(input: {
    receiptId: string;
    repositoryId: number;
    installationId: number;
    pullRequest: number;
    headSha: string;
    baseSha: string;
    expiresAt: Date;
  }): Promise<void>;
  ready(): Promise<void>;
  claimNext(leaseToken: string, leaseDurationMs: number): Promise<ClaimedWebhook | null>;
  complete(deliveryId: string, leaseToken: string): Promise<boolean>;
  fail(deliveryId: string, leaseToken: string, errorCode: string): Promise<boolean>;
  retry(
    deliveryId: string,
    leaseToken: string,
    errorCode: string,
    nextAttemptAt: Date,
  ): Promise<boolean>;
}

/** Durable, idempotent webhook queue with expiring claims and fenced updates. */
export class PostgresWebhookInbox implements WebhookInbox {
  constructor(private readonly db: ReviewControllerDatabase) {}

  async enqueue(webhook: AcceptedWebhook): Promise<{ inserted: boolean }> {
    const result = await this.db
      .insert(reviewControllerWebhookInbox)
      .values({
        deliveryId: webhook.deliveryId,
        eventName: webhook.event,
        installationId: webhook.installationId,
        repositoryId: webhook.repositoryId,
        receivedAt: new Date(webhook.receivedAt),
        payload: webhook.payload,
        state: 'pending',
      })
      .onConflictDoNothing()
      .returning({ deliveryId: reviewControllerWebhookInbox.deliveryId });
    return { inserted: result.length === 1 };
  }

  async scheduleReceiptExpiration(input: {
    receiptId: string;
    repositoryId: number;
    installationId: number;
    pullRequest: number;
    headSha: string;
    baseSha: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input.receiptId)) throw new Error('invalid receipt ID');
    if (
      !Number.isSafeInteger(input.repositoryId) ||
      input.repositoryId <= 0 ||
      !Number.isSafeInteger(input.installationId) ||
      input.installationId <= 0 ||
      !Number.isSafeInteger(input.pullRequest) ||
      input.pullRequest <= 0 ||
      !/^[a-f0-9]{40,64}$/.test(input.headSha) ||
      !/^[a-f0-9]{40,64}$/.test(input.baseSha) ||
      !Number.isFinite(input.expiresAt.getTime())
    )
      throw new Error('invalid receipt expiration schedule');
    await this.db
      .insert(reviewControllerWebhookInbox)
      .values({
        deliveryId: `receipt-expiry-${input.receiptId}`,
        eventName: 'receipt_expiration',
        installationId: input.installationId,
        repositoryId: input.repositoryId,
        receivedAt: new Date(),
        nextAttemptAt: input.expiresAt,
        payload: {
          receiptId: input.receiptId,
          pullRequest: input.pullRequest,
          headSha: input.headSha,
          baseSha: input.baseSha,
        },
        state: 'pending',
      })
      .onConflictDoNothing();
  }

  async ready(): Promise<void> {
    await this.db
      .select({ deliveryId: reviewControllerWebhookInbox.deliveryId })
      .from(reviewControllerWebhookInbox)
      .limit(0);
    await this.db
      .select({ observationId: reviewControllerShadowObservations.observationId })
      .from(reviewControllerShadowObservations)
      .limit(0);
  }

  async claimNext(leaseToken: string, leaseDurationMs: number): Promise<ClaimedWebhook | null> {
    if (!/^[0-9a-f-]{36}$/i.test(leaseToken)) throw new Error('invalid lease token');
    if (
      !Number.isSafeInteger(leaseDurationMs) ||
      leaseDurationMs < 1_000 ||
      leaseDurationMs > 300_000
    )
      throw new Error('invalid lease duration');

    return this.db.transaction(async (tx) => {
      const now = new Date();
      await tx
        .update(reviewControllerWebhookInbox)
        .set({
          state: 'failed',
          lastErrorCode: 'attempt_limit',
          lockedUntil: null,
          leaseToken: null,
        })
        .where(
          and(
            eq(reviewControllerWebhookInbox.state, 'processing'),
            lte(reviewControllerWebhookInbox.lockedUntil, now),
            gte(reviewControllerWebhookInbox.attempts, MAX_WEBHOOK_ATTEMPTS),
            sql`${reviewControllerWebhookInbox.eventName} <> 'receipt_expiration'`,
          ),
        );

      const [candidate] = await tx
        .select({ deliveryId: reviewControllerWebhookInbox.deliveryId })
        .from(reviewControllerWebhookInbox)
        .where(
          or(
            and(
              eq(reviewControllerWebhookInbox.state, 'pending'),
              or(
                lte(reviewControllerWebhookInbox.attempts, MAX_WEBHOOK_ATTEMPTS - 1),
                eq(reviewControllerWebhookInbox.eventName, 'receipt_expiration'),
              ),
              lte(reviewControllerWebhookInbox.nextAttemptAt, now),
            ),
            and(
              eq(reviewControllerWebhookInbox.state, 'processing'),
              lte(reviewControllerWebhookInbox.lockedUntil, now),
              or(
                lte(reviewControllerWebhookInbox.attempts, MAX_WEBHOOK_ATTEMPTS - 1),
                eq(reviewControllerWebhookInbox.eventName, 'receipt_expiration'),
              ),
            ),
          ),
        )
        .orderBy(
          asc(reviewControllerWebhookInbox.nextAttemptAt),
          asc(reviewControllerWebhookInbox.receivedAt),
          asc(reviewControllerWebhookInbox.deliveryId),
        )
        .for('update', { skipLocked: true })
        .limit(1);
      if (!candidate) return null;

      const [claimed] = await tx
        .update(reviewControllerWebhookInbox)
        .set({
          state: 'processing',
          attempts: sql`${reviewControllerWebhookInbox.attempts} + 1`,
          lockedUntil: new Date(now.getTime() + leaseDurationMs),
          leaseToken,
        })
        .where(eq(reviewControllerWebhookInbox.deliveryId, candidate.deliveryId))
        .returning();
      if (!claimed) return null;
      return {
        deliveryId: claimed.deliveryId,
        eventName: claimed.eventName,
        installationId: claimed.installationId,
        repositoryId: claimed.repositoryId,
        receivedAt: claimed.receivedAt,
        payload: claimed.payload,
        attempts: claimed.attempts,
        leaseToken: claimed.leaseToken ?? leaseToken,
      };
    });
  }

  async complete(deliveryId: string, leaseToken: string): Promise<boolean> {
    const result = await this.db
      .update(reviewControllerWebhookInbox)
      .set({ state: 'completed', completedAt: new Date(), lockedUntil: null, leaseToken: null })
      .where(
        and(
          eq(reviewControllerWebhookInbox.deliveryId, deliveryId),
          eq(reviewControllerWebhookInbox.state, 'processing'),
          eq(reviewControllerWebhookInbox.leaseToken, leaseToken),
        ),
      )
      .returning({ deliveryId: reviewControllerWebhookInbox.deliveryId });
    return result.length === 1;
  }

  async fail(deliveryId: string, leaseToken: string, errorCode: string): Promise<boolean> {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(errorCode)) throw new Error('invalid error code');
    const result = await this.db
      .update(reviewControllerWebhookInbox)
      .set({ state: 'failed', lastErrorCode: errorCode, lockedUntil: null, leaseToken: null })
      .where(
        and(
          eq(reviewControllerWebhookInbox.deliveryId, deliveryId),
          eq(reviewControllerWebhookInbox.state, 'processing'),
          eq(reviewControllerWebhookInbox.leaseToken, leaseToken),
        ),
      )
      .returning({ deliveryId: reviewControllerWebhookInbox.deliveryId });
    return result.length === 1;
  }

  async retry(
    deliveryId: string,
    leaseToken: string,
    errorCode: string,
    nextAttemptAt: Date,
  ): Promise<boolean> {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(errorCode)) throw new Error('invalid error code');
    if (!Number.isFinite(nextAttemptAt.getTime())) throw new Error('invalid retry time');
    return this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .select({
          attempts: reviewControllerWebhookInbox.attempts,
          eventName: reviewControllerWebhookInbox.eventName,
        })
        .from(reviewControllerWebhookInbox)
        .where(
          and(
            eq(reviewControllerWebhookInbox.deliveryId, deliveryId),
            eq(reviewControllerWebhookInbox.state, 'processing'),
            eq(reviewControllerWebhookInbox.leaseToken, leaseToken),
          ),
        )
        .for('update')
        .limit(1);
      if (!claimed) return false;
      const result = await tx
        .update(reviewControllerWebhookInbox)
        .set({
          state:
            claimed.attempts >= MAX_WEBHOOK_ATTEMPTS && claimed.eventName !== 'receipt_expiration'
              ? 'failed'
              : 'pending',
          nextAttemptAt,
          lastErrorCode: errorCode,
          lockedUntil: null,
          leaseToken: null,
        })
        .where(
          and(
            eq(reviewControllerWebhookInbox.deliveryId, deliveryId),
            eq(reviewControllerWebhookInbox.state, 'processing'),
            eq(reviewControllerWebhookInbox.leaseToken, leaseToken),
          ),
        )
        .returning({ deliveryId: reviewControllerWebhookInbox.deliveryId });
      return result.length === 1;
    });
  }
}
