import type { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase } from './__tests__/database.js';
import { PostgresWebhookInbox } from './inbox.js';
import type { AcceptedWebhook } from './webhook.js';

describe('PostgresWebhookInbox', () => {
  let db: PGlite;
  let inbox: PostgresWebhookInbox;

  beforeEach(async () => {
    const database = await createTestDatabase();
    db = database.client;
    inbox = new PostgresWebhookInbox(database.db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('deduplicates webhook delivery and completes only the current lease', async () => {
    await inbox.enqueue(webhook('00000000-0000-4000-8000-000000000001'));
    expect((await inbox.enqueue(webhook('00000000-0000-4000-8000-000000000001'))).inserted).toBe(
      false,
    );

    const claim = await inbox.claimNext('11111111-1111-4111-8111-111111111111', 30_000);
    expect(claim).toMatchObject({
      deliveryId: '00000000-0000-4000-8000-000000000001',
      attempts: 1,
    });
    expect(await inbox.claimNext('22222222-2222-4222-8222-222222222222', 30_000)).toBeNull();
    expect(
      await inbox.complete(
        '00000000-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).toBe(false);
    expect(
      await inbox.complete(
        '00000000-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).toBe(true);
    expect(await inbox.claimNext('33333333-3333-4333-8333-333333333333', 30_000)).toBeNull();
  });

  it('reclaims expired leases and fences stale workers from completing work', async () => {
    await inbox.enqueue(webhook('00000000-0000-4000-8000-000000000002'));
    const first = '11111111-1111-4111-8111-111111111111';
    const second = '22222222-2222-4222-8222-222222222222';
    await inbox.claimNext(first, 30_000);
    await db.exec(
      "UPDATE review_controller_webhook_inbox SET locked_until = '2000-01-01T00:00:00Z'",
    );

    const reclaimed = await inbox.claimNext(second, 30_000);
    expect(reclaimed?.attempts).toBe(2);
    expect(await inbox.complete('00000000-0000-4000-8000-000000000002', first)).toBe(false);
    expect(await inbox.complete('00000000-0000-4000-8000-000000000002', second)).toBe(true);
  });

  it('retries failed processing and caps attempts at the configured maximum', async () => {
    await inbox.enqueue(webhook('00000000-0000-4000-8000-000000000003'));
    const claim = await inbox.claimNext('11111111-1111-4111-8111-111111111111', 30_000);
    expect(claim).not.toBeNull();
    expect(
      await inbox.retry(
        '00000000-0000-4000-8000-000000000003',
        '11111111-1111-4111-8111-111111111111',
        'temporary_failure',
        new Date('2000-01-01T00:00:00Z'),
      ),
    ).toBe(true);
    const retried = await inbox.claimNext('22222222-2222-4222-8222-222222222222', 30_000);
    expect(retried?.attempts).toBe(2);

    await db.query(
      'UPDATE review_controller_webhook_inbox SET attempts = 12 WHERE delivery_id = $1',
      ['00000000-0000-4000-8000-000000000003'],
    );
    expect(
      await inbox.retry(
        '00000000-0000-4000-8000-000000000003',
        '22222222-2222-4222-8222-222222222222',
        'temporary_failure',
        new Date('2000-01-01T00:00:00Z'),
      ),
    ).toBe(true);
    expect(await inbox.claimNext('33333333-3333-4333-8333-333333333333', 30_000)).toBeNull();
    const row = await db.query<{ state: string; attempts: number }>(
      'SELECT state, attempts FROM review_controller_webhook_inbox WHERE delivery_id = $1',
      ['00000000-0000-4000-8000-000000000003'],
    );
    expect(row.rows[0]).toMatchObject({ state: 'failed', attempts: 12 });
  });

  it('dead-letters a crashed final attempt after its lease expires', async () => {
    await inbox.enqueue(webhook('00000000-0000-4000-8000-000000000004'));
    const token = '11111111-1111-4111-8111-111111111111';
    await inbox.claimNext(token, 30_000);
    await db.query(
      `UPDATE review_controller_webhook_inbox
       SET attempts = 12, locked_until = '2000-01-01T00:00:00Z'
       WHERE delivery_id = $1`,
      ['00000000-0000-4000-8000-000000000004'],
    );

    expect(await inbox.claimNext('22222222-2222-4222-8222-222222222222', 30_000)).toBeNull();
    const row = await db.query<{ state: string; last_error_code: string }>(
      'SELECT state, last_error_code FROM review_controller_webhook_inbox WHERE delivery_id = $1',
      ['00000000-0000-4000-8000-000000000004'],
    );
    expect(row.rows[0]).toMatchObject({ state: 'failed', last_error_code: 'attempt_limit' });
  });

  it('durably schedules and claims an idempotent receipt-expiration event at expiry', async () => {
    const input = {
      receiptId: 'receipt-abcdef',
      repositoryId: 123,
      installationId: 456,
      pullRequest: 7,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      expiresAt: new Date('2000-01-01T00:00:00.000Z'),
    };
    await inbox.scheduleReceiptExpiration(input);
    await inbox.scheduleReceiptExpiration(input);
    const claim = await inbox.claimNext('11111111-1111-4111-8111-111111111111', 30_000);
    expect(claim).toMatchObject({
      deliveryId: 'receipt-expiry-receipt-abcdef',
      eventName: 'receipt_expiration',
      repositoryId: 123,
      installationId: 456,
      payload: {
        receiptId: 'receipt-abcdef',
        pullRequest: 7,
        headSha: 'a'.repeat(40),
        baseSha: 'b'.repeat(40),
      },
    });
    expect(
      await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM review_controller_webhook_inbox WHERE event_name = 'receipt_expiration'",
      ),
    ).toMatchObject({ rows: [{ count: 1 }] });
  });

  it('keeps receipt-expiration work retryable after the ordinary webhook attempt limit', async () => {
    await inbox.scheduleReceiptExpiration({
      receiptId: 'receipt-retry',
      repositoryId: 123,
      installationId: 456,
      pullRequest: 7,
      headSha: 'a'.repeat(40),
      baseSha: 'b'.repeat(40),
      expiresAt: new Date('2000-01-01T00:00:00.000Z'),
    });
    const deliveryId = 'receipt-expiry-receipt-retry';
    const lease = '11111111-1111-4111-8111-111111111111';
    await inbox.claimNext(lease, 30_000);
    await db.query(
      'UPDATE review_controller_webhook_inbox SET attempts = 12 WHERE delivery_id = $1',
      [deliveryId],
    );
    expect(await inbox.retry(deliveryId, lease, 'handler_error', new Date('2000-01-01'))).toBe(
      true,
    );
    const row = await db.query<{ state: string; attempts: number }>(
      'SELECT state, attempts FROM review_controller_webhook_inbox WHERE delivery_id = $1',
      [deliveryId],
    );
    expect(row.rows[0]).toMatchObject({ state: 'pending', attempts: 12 });
    expect((await inbox.claimNext('22222222-2222-4222-8222-222222222222', 30_000))?.attempts).toBe(
      13,
    );
  });
});

function webhook(deliveryId: string): AcceptedWebhook {
  return {
    deliveryId,
    repositoryId: 123,
    installationId: 456,
    event: 'pull_request',
    payload: {
      action: 'opened',
      repository: { id: 123, full_name: 'RevealUIStudio/revealui' },
      installation: { id: 456 },
      pull_request: { number: 7 },
    },
    receivedAt: '2026-10-06T12:00:00.000Z',
  };
}
