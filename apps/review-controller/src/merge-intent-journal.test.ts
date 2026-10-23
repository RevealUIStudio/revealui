import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from './__tests__/database.js';
import { makeMergeIntent, mergeIntentNow } from './__tests__/merge-intent.js';
import { PostgresMergeIntentJournal } from './merge-intent-journal.js';

describe('disabled durable merge intent custody', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => {
    database = await createTestDatabase();
  });
  afterAll(async () => {
    await database.client.close();
  });
  const journal = () => new PostgresMergeIntentJournal(database.db, () => mergeIntentNow);

  it('confirms identical proposal replay and rejects ID reuse for changed bytes', async () => {
    const first = await journal().propose(makeMergeIntent());
    expect(await journal().propose(makeMergeIntent())).toEqual(first);
    await expect(journal().propose(makeMergeIntent({ treeOid: '9'.repeat(40) }))).rejects.toThrow(
      'merge_intent_id_collision',
    );
  });

  it('fences competing job IDs and retains scope quarantine across restart', async () => {
    const left = makeMergeIntent({ jobId: '2'.repeat(64), baseRef: 'refs/heads/concurrent' });
    const right = { ...left, jobId: '3'.repeat(64) };
    await journal().propose(left);
    await journal().propose(right);
    const outcomes = await Promise.allSettled([
      journal().recordInertDispatch(left.jobId),
      journal().recordInertDispatch(right.jobId),
    ]);
    expect(outcomes.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((value) => value.status === 'rejected')).toHaveLength(1);
    expect(await journal().quarantineAbandonedDispatches()).toBe(1);
    await expect(journal().recordInertDispatch(left.jobId)).rejects.toThrow();
    await expect(journal().recordInertDispatch(right.jobId)).rejects.toThrow();
  });

  it('never treats unchanged refs or a reported rejection as permission to retry', async () => {
    const intent = makeMergeIntent({ jobId: '4'.repeat(64), baseRef: 'refs/heads/uncertain' });
    await journal().propose(intent);
    await journal().recordInertDispatch(intent.jobId);
    await journal().quarantine(intent.jobId);
    for (const kind of ['refs-unchanged', 'definitive-rejection'] as const) {
      const input = {
        jobId: intent.jobId,
        kind,
        evidenceSha256: 'a'.repeat(64),
        observedAt: mergeIntentNow.toISOString(),
      };
      const result = await journal().recordReconciliationObservation(input);
      expect(result.hold).toBe('merge_reconciliation_authority_unsupported');
      expect(await journal().recordReconciliationObservation(input)).toEqual(result);
    }
    const other = { ...intent, jobId: '5'.repeat(64) };
    await journal().propose(other);
    await expect(journal().recordInertDispatch(other.jobId)).rejects.toThrow(
      'merge_scope_quarantined',
    );
  });

  it('rechecks expiry before consuming an inert dispatch', async () => {
    const intent = makeMergeIntent({ jobId: '6'.repeat(64), baseRef: 'refs/heads/expired' });
    await journal().propose(intent);
    const late = new PostgresMergeIntentJournal(
      database.db,
      () => new Date('2026-10-22T22:02:00.000Z'),
    );
    await expect(late.recordInertDispatch(intent.jobId)).rejects.toThrow('merge_receipt_expired');
  });

  it('enforces immutable identity and terminal quarantine in the database', async () => {
    const id = '4'.repeat(64);
    await expect(
      database.db.execute(
        sql`UPDATE review_controller_merge_intents SET state = 'proposed' WHERE job_id = ${id}`,
      ),
    ).rejects.toMatchObject({
      cause: { code: 'P0001', message: 'merge_intent_transition_forbidden' },
    });
    await expect(
      database.db.execute(
        sql`UPDATE review_controller_merge_intents SET base_ref = 'refs/heads/other' WHERE job_id = ${id}`,
      ),
    ).rejects.toMatchObject({
      cause: { code: 'P0001', message: 'merge_intent_identity_immutable' },
    });
    await expect(
      database.db.execute(sql`DELETE FROM review_controller_merge_intents WHERE job_id = ${id}`),
    ).rejects.toMatchObject({
      cause: { code: 'P0001', message: 'merge_intent_deletion_forbidden' },
    });
    await expect(
      database.db.execute(
        sql`TRUNCATE review_controller_merge_intents, review_controller_merge_reconciliation_observations`,
      ),
    ).rejects.toMatchObject({ cause: { code: 'P0001' } });
    await expect(
      database.db.execute(
        sql`DELETE FROM review_controller_merge_reconciliation_observations WHERE job_id = ${id}`,
      ),
    ).rejects.toMatchObject({
      cause: { code: 'P0001', message: 'merge_reconciliation_observation_immutable' },
    });
  });
});
