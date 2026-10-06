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

interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number | null;
}

interface InboxDatabase {
  query<Row = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

export interface WebhookInbox {
  enqueue(webhook: AcceptedWebhook): Promise<{ inserted: boolean }>;
  ready(): Promise<void>;
  claimNext(leaseToken: string, leaseDurationMs: number): Promise<ClaimedWebhook | null>;
  complete(deliveryId: string, leaseToken: string): Promise<boolean>;
  retry(
    deliveryId: string,
    leaseToken: string,
    errorCode: string,
    nextAttemptAt: Date,
  ): Promise<boolean>;
}

/** Durable, idempotent webhook queue with expiring claims and fenced updates. */
export class PostgresWebhookInbox implements WebhookInbox {
  constructor(private readonly pool: InboxDatabase) {}

  async enqueue(webhook: AcceptedWebhook): Promise<{ inserted: boolean }> {
    const result = await this.pool.query(
      `INSERT INTO review_controller_webhook_inbox
        (delivery_id, event_name, installation_id, repository_id, received_at, payload, state)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending')
       ON CONFLICT (delivery_id) DO NOTHING
       RETURNING delivery_id`,
      [
        webhook.deliveryId,
        webhook.event,
        webhook.installationId,
        webhook.repositoryId,
        webhook.receivedAt,
        JSON.stringify(webhook.payload),
      ],
    );
    return { inserted: result.rowCount === 1 };
  }

  async ready(): Promise<void> {
    await this.pool.query('SELECT delivery_id FROM review_controller_webhook_inbox LIMIT 0');
    await this.pool.query(
      'SELECT observation_id FROM review_controller_shadow_observations LIMIT 0',
    );
  }

  async claimNext(leaseToken: string, leaseDurationMs: number): Promise<ClaimedWebhook | null> {
    if (!/^[0-9a-f-]{36}$/i.test(leaseToken)) throw new Error('invalid lease token');
    if (
      !Number.isSafeInteger(leaseDurationMs) ||
      leaseDurationMs < 1_000 ||
      leaseDurationMs > 300_000
    )
      throw new Error('invalid lease duration');
    await this.pool.query(
      `UPDATE review_controller_webhook_inbox
       SET state = 'failed', last_error_code = 'attempt_limit', locked_until = NULL, lease_token = NULL
       WHERE state = 'processing' AND locked_until <= clock_timestamp() AND attempts >= $1`,
      [MAX_WEBHOOK_ATTEMPTS],
    );
    const result = await this.pool.query<ClaimedWebhook>(
      `WITH candidate AS (
         SELECT delivery_id
         FROM review_controller_webhook_inbox
         WHERE (state IN ('pending', 'failed') AND attempts < $3 AND next_attempt_at <= clock_timestamp())
            OR (state = 'processing' AND locked_until <= clock_timestamp() AND attempts < $3)
         ORDER BY next_attempt_at, received_at, delivery_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE review_controller_webhook_inbox AS inbox
       SET state = 'processing',
           attempts = inbox.attempts + 1,
           locked_until = clock_timestamp() + ($2::double precision * interval '1 millisecond'),
           lease_token = $1::uuid
       FROM candidate
       WHERE inbox.delivery_id = candidate.delivery_id
       RETURNING inbox.delivery_id AS "deliveryId",
                 inbox.event_name AS "eventName",
                 inbox.installation_id::double precision AS "installationId",
                 inbox.repository_id::double precision AS "repositoryId",
                 inbox.received_at AS "receivedAt",
                 inbox.payload,
                 inbox.attempts,
                 inbox.lease_token AS "leaseToken"`,
      [leaseToken, leaseDurationMs, MAX_WEBHOOK_ATTEMPTS],
    );
    return result.rows[0] ?? null;
  }

  async complete(deliveryId: string, leaseToken: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE review_controller_webhook_inbox
       SET state = 'completed', completed_at = clock_timestamp(), locked_until = NULL, lease_token = NULL
       WHERE delivery_id = $1 AND state = 'processing' AND lease_token = $2::uuid`,
      [deliveryId, leaseToken],
    );
    return result.rowCount === 1;
  }

  async retry(
    deliveryId: string,
    leaseToken: string,
    errorCode: string,
    nextAttemptAt: Date,
  ): Promise<boolean> {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(errorCode)) throw new Error('invalid error code');
    if (!Number.isFinite(nextAttemptAt.getTime())) throw new Error('invalid retry time');
    const result = await this.pool.query(
      `UPDATE review_controller_webhook_inbox
       SET state = CASE WHEN attempts >= $4 THEN 'failed' ELSE 'pending' END,
           next_attempt_at = $3,
           last_error_code = $5,
           locked_until = NULL,
           lease_token = NULL
       WHERE delivery_id = $1 AND state = 'processing' AND lease_token = $2::uuid`,
      [deliveryId, leaseToken, nextAttemptAt.toISOString(), MAX_WEBHOOK_ATTEMPTS, errorCode],
    );
    return result.rowCount === 1;
  }
}
