/**
 * Convergence: the same op-set applied in two different interleavings, from two
 * site ids, reaches identical state (spec §8.1). The ops are produced by the
 * real scan pipeline (`applyScan`) and replayed on a second site in a permuted
 * order; the class-1/2 merge rules make the final state order-independent.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { deriveNodeId } from '../ids.js';
import { applyOp, applyOps, applyScan } from '../ingest/index.js';
import { aliasOp } from '../ingest/resolve.js';
import { crossBatchInterleave, permuteOps, workspaceScan } from './fixtures.js';
import { createKgTestDb, type KgTestDb, snapshot } from './test-db.js';

let dbs: KgTestDb[] = [];
async function fresh(): Promise<KgTestDb> {
  const db = await createKgTestDb();
  dbs.push(db);
  return db;
}

afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

describe('convergence', () => {
  it('two interleavings from two sites reach identical state', async () => {
    const t1 = new Date('2026-07-01T00:00:00Z');
    const t2 = new Date('2026-07-05T00:00:00Z');

    const siteA = await fresh();
    const siteB = await fresh();

    // Site A applies the scans directly (natural op order).
    const r1 = await applyScan(siteA.exec, workspaceScan('revealui', ['core', 'db'], t1), {
      recordOutbox: true,
    });
    const r2 = await applyScan(siteA.exec, workspaceScan('revealui', ['core'], t2), {
      recordOutbox: true,
    });

    // Site B replays the SAME ops in a cross-batch interleaving (batch-2 node
    // upserts before batch-1's) under a different site id — only convergent if
    // the monotonic merge rules hold.
    await applyOps(siteB.exec, crossBatchInterleave(r1.ops, r2.ops), {
      siteId: 'site-B',
      recordOutbox: true,
    });

    const snapA = await snapshot(siteA.exec);
    const snapB = await snapshot(siteB.exec);
    expect(snapB).toEqual(snapA);

    // The dropped package's `contains` edge is invalidated on both, not deleted.
    const invalidated = r2.invalidatedEdgeIds;
    expect(invalidated).toHaveLength(1);
  });

  it('op replay is idempotent (applying twice equals once)', async () => {
    const t1 = new Date('2026-07-01T00:00:00Z');
    const db = await fresh();
    const r = await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], t1));
    const once = await snapshot(db.exec);
    await applyOps(db.exec, r.ops);
    await applyOps(db.exec, permuteOps(r.ops));
    const thrice = await snapshot(db.exec);
    expect(thrice).toEqual(once);
  });

  it('alias inserts are order-independent G-Set unions', async () => {
    const t1 = new Date('2026-07-01T00:00:00Z');
    const siteA = await fresh();
    const siteB = await fresh();
    const scan = workspaceScan('revealui', ['core'], t1);
    const r = await applyScan(siteA.exec, scan);
    const coreId = deriveNodeId('package', 'revealui:pkg:core');
    const a1 = aliasOp('the core package', coreId);
    const a2 = aliasOp('@revealui/core', coreId);
    await applyOp(siteA.exec, a1);
    await applyOp(siteA.exec, a2);

    await applyOps(siteB.exec, permuteOps(r.ops));
    await applyOp(siteB.exec, a2); // reversed order
    await applyOp(siteB.exec, a1);
    await applyOp(siteB.exec, a1); // duplicate — no-op

    expect(await snapshot(siteB.exec)).toEqual(await snapshot(siteA.exec));
  });
});
