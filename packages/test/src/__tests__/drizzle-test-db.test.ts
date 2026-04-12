/**
 * Integration tests for PGlite + Drizzle test harness.
 * Verifies schema application, CRUD operations, and cleanup.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanTables, createTestDb, seedTestUser, type TestDb } from '../utils/drizzle-test-db.js';

describe('createTestDb', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  it('creates an in-memory database with schemas applied', () => {
    expect(db.drizzle).toBeDefined();
    expect(db.pglite).toBeDefined();
  });

  it('can query empty tables', async () => {
    const { users } = await import('@revealui/db/schema');
    const rows = await db.drizzle.select().from(users);
    expect(rows).toEqual([]);
  });

  it('seedTestUser inserts a user', async () => {
    const { users } = await import('@revealui/db/schema');
    const user = await seedTestUser(db.drizzle, {
      id: 'test-user-1',
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(user.id).toBe('test-user-1');
    expect(user.email).toBe('alice@example.com');

    const rows = await db.drizzle.select().from(users).where(eq(users.id, 'test-user-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');
  });

  it('supports insert + select on licenses table', async () => {
    const { licenses } = await import('@revealui/db/schema');

    await db.drizzle.insert(licenses).values({
      id: 'lic-test-1',
      userId: 'test-user-1',
      licenseKey: 'jwt-test-key',
      tier: 'pro',
      customerId: 'cus_test_123',
      status: 'active',
    });

    const rows = await db.drizzle.select().from(licenses).where(eq(licenses.id, 'lic-test-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].tier).toBe('pro');
    expect(rows[0].status).toBe('active');
    expect(rows[0].perpetual).toBe(false);
  });

  it('supports insert on processedWebhookEvents', async () => {
    const { processedWebhookEvents } = await import('@revealui/db/schema');

    await db.drizzle.insert(processedWebhookEvents).values({
      id: 'evt_test_123',
      eventType: 'checkout.session.completed',
    });

    const rows = await db.drizzle
      .select()
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.id, 'evt_test_123'));

    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe('checkout.session.completed');
    expect(rows[0].processedAt).toBeInstanceOf(Date);
  });

  it('supports insert on accounts and accountSubscriptions', async () => {
    const { accounts, accountSubscriptions } = await import('@revealui/db/schema');

    await db.drizzle.insert(accounts).values({
      id: 'acct-test-1',
      name: 'Test Org',
      slug: 'test-org',
    });

    await db.drizzle.insert(accountSubscriptions).values({
      id: 'sub-test-1',
      accountId: 'acct-test-1',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_456',
      planId: 'plan_pro',
      status: 'active',
    });

    const subs = await db.drizzle
      .select()
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.accountId, 'acct-test-1'));

    expect(subs).toHaveLength(1);
    expect(subs[0].stripeSubscriptionId).toBe('sub_test_456');
  });

  it('supports transactions', async () => {
    const { processedWebhookEvents } = await import('@revealui/db/schema');

    await db.drizzle.transaction(async (tx) => {
      await tx.insert(processedWebhookEvents).values({
        id: 'evt_tx_test',
        eventType: 'invoice.payment_succeeded',
      });
    });

    const rows = await db.drizzle
      .select()
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.id, 'evt_tx_test'));

    expect(rows).toHaveLength(1);
  });

  it('cleanTables removes all rows', async () => {
    const { processedWebhookEvents } = await import('@revealui/db/schema');

    await cleanTables(db.drizzle, [
      'account_subscriptions',
      'accounts',
      'licenses',
      'processed_webhook_events',
    ]);

    const rows = await db.drizzle.select().from(processedWebhookEvents);
    expect(rows).toEqual([]);
  });
});

describe('createTestDb isolation', () => {
  it('each call creates a fresh database', async () => {
    const db1 = await createTestDb();
    const db2 = await createTestDb();

    const { users } = await import('@revealui/db/schema');

    await seedTestUser(db1.drizzle, { id: 'iso-1', name: 'DB1' });

    const db1Rows = await db1.drizzle.select().from(users).where(eq(users.id, 'iso-1'));
    const db2Rows = await db2.drizzle.select().from(users).where(eq(users.id, 'iso-1'));

    expect(db1Rows).toHaveLength(1);
    expect(db2Rows).toHaveLength(0); // isolated  -  no data leakage

    await db1.close();
    await db2.close();
  }, 30_000);
});
