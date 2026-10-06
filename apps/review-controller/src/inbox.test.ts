import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostgresWebhookInbox } from './inbox.js';
import type { AcceptedWebhook } from './webhook.js';

describe('PostgresWebhookInbox', () => {
  let db: PGlite;
  let inbox: PostgresWebhookInbox;

  beforeEach(async () => {
    db = new PGlite();
    const migration = await readFile(
      resolve(process.cwd(), 'migrations/0001_webhook_inbox.sql'),
      'utf8',
    );
    await db.exec(migration);
    inbox = new PostgresWebhookInbox({
      query: async <Row>(sql: string, values?: unknown[]) => {
        const result = await db.query(sql, values);
        return { rows: result.rows as Row[], rowCount: result.affectedRows ?? null };
      },
    });
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
