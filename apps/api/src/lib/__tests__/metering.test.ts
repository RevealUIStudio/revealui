/**
 * PGlite-backed integration test for `recordUsageMeter`. Exercises the
 * real SQL path end-to-end — insert validates against schema constraints
 * (NOT NULL accountId fk, source CHECK, unique idempotencyKey).
 */

import { accounts, type NewUsageMeter, usageMeters } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTestDb,
  type TestDb,
} from '../../../../../packages/test/src/utils/drizzle-test-db.js';

let testDb: TestDb;

vi.mock('@revealui/db', async () => {
  const actual = await vi.importActual<typeof import('@revealui/db')>('@revealui/db');
  return {
    ...actual,
    getClient: () => testDb.drizzle,
  };
});

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

async function seedAccount(db: TestDb, id = 'acct_test'): Promise<string> {
  await db.drizzle.insert(accounts).values({
    id,
    name: 'Test Account',
    slug: `test-${id}`,
    status: 'active',
  });
  return id;
}

function makeRow(overrides: Partial<NewUsageMeter> = {}): NewUsageMeter {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    accountId: overrides.accountId ?? 'acct_test',
    meterName: overrides.meterName ?? 'mcp.tool.call',
    quantity: overrides.quantity ?? 1,
    periodStart: overrides.periodStart ?? new Date('2026-04-23T22:00:00Z'),
    periodEnd: overrides.periodEnd ?? null,
    source: overrides.source ?? 'agent',
    idempotencyKey: overrides.idempotencyKey ?? crypto.randomUUID(),
  };
}

describe('recordUsageMeter', () => {
  beforeEach(async () => {
    testDb = await createTestDb();
  });

  afterEach(async () => {
    await testDb.close();
  });

  it('persists a usage_meters row', async () => {
    const { recordUsageMeter } = await import('../metering.js');
    await seedAccount(testDb);

    const row = makeRow({ meterName: 'mcp.tool.call' });
    await recordUsageMeter(row);

    const persisted = await testDb.drizzle
      .select()
      .from(usageMeters)
      .where(eq(usageMeters.idempotencyKey, row.idempotencyKey));
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      accountId: 'acct_test',
      meterName: 'mcp.tool.call',
      quantity: 1,
      source: 'agent',
    });
  });

  it('is idempotent on idempotencyKey (duplicate call keeps one row)', async () => {
    const { recordUsageMeter } = await import('../metering.js');
    await seedAccount(testDb);

    const key = 'mcp.tool.call:acct_test:linear:search_issues:1714000000000';
    const first = makeRow({ idempotencyKey: key, meterName: 'mcp.tool.call' });
    const second = makeRow({
      idempotencyKey: key,
      meterName: 'mcp.tool.call',
      // New synthetic id — schema allows, but the unique key should still dedupe.
    });

    await recordUsageMeter(first);
    await recordUsageMeter(second);

    const rows = await testDb.drizzle
      .select()
      .from(usageMeters)
      .where(eq(usageMeters.idempotencyKey, key));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(first.id);
  });

  it('persists rows for every supported `kind` → `meterName` mapping', async () => {
    const { recordUsageMeter } = await import('../metering.js');
    await seedAccount(testDb);

    const kinds: string[] = [
      'mcp.tool.call',
      'mcp.resource.list',
      'mcp.resource.read',
      'mcp.prompt.list',
      'mcp.prompt.get',
      'mcp.sampling.create',
      'mcp.elicitation.create',
    ];

    for (const meterName of kinds) {
      await recordUsageMeter(makeRow({ meterName }));
    }

    const rows = await testDb.drizzle
      .select()
      .from(usageMeters)
      .where(eq(usageMeters.accountId, 'acct_test'));
    expect(rows.map((r) => r.meterName).sort()).toEqual([...kinds].sort());
  });

  it('rejects rows whose accountId does not exist (fk violation propagates)', async () => {
    const { recordUsageMeter } = await import('../metering.js');
    // Intentionally skip seedAccount — the row references a nonexistent account.

    await expect(recordUsageMeter(makeRow({ accountId: 'acct_missing' }))).rejects.toThrow();
  });
});
