/**
 * Temporal invalidation + point-in-time (spec §6, §7).
 *
 * Re-scanning a scope invalidates edges that are now absent (invalid_at =
 * scan.referenceTime, never deleted); a point-in-time query before the re-scan
 * still returns the pre-rescan state.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deriveNodeId } from '../ids.js';
import { applyScan } from '../ingest/index.js';
import { kgAtTime } from '../search/index.js';
import { workspaceScan } from './fixtures.js';
import { createKgTestDb, type KgTestDb } from './test-db.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

const T1 = new Date('2026-07-01T00:00:00Z');
const T_MID = new Date('2026-07-03T00:00:00Z');
const T2 = new Date('2026-07-05T00:00:00Z');
const NOW = new Date('2026-07-10T00:00:00Z');

const repoId = deriveNodeId('repo', 'revealui');

async function currentContains(at: Date): Promise<string[]> {
  const facts = await kgAtTime(db.exec, repoId, at);
  return facts
    .filter((f) => f.relation === 'contains')
    .map((f) => f.fact)
    .sort();
}

describe('re-scan diff invalidation', () => {
  it('invalidates the absent edge at the re-scan reference time', async () => {
    await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T1));
    const result = await applyScan(db.exec, workspaceScan('revealui', ['core'], T2));

    expect(result.invalidatedEdgeIds).toHaveLength(1);
    const rows = await db.exec.query<{ invalid_at: string | null; fact: string }>(
      `SELECT invalid_at, fact FROM kg_edges WHERE relation = 'contains' ORDER BY fact`,
    );
    const dbEdge = rows.find((r) => r.fact.includes('contains db'));
    const coreEdge = rows.find((r) => r.fact.includes('contains core'));
    expect(coreEdge?.invalid_at).toBeNull();
    expect(dbEdge?.invalid_at).not.toBeNull();
    expect(new Date(dbEdge?.invalid_at ?? 0).toISOString()).toBe(T2.toISOString());
  });

  it('point-in-time returns the pre-rescan state', async () => {
    await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T1));
    await applyScan(db.exec, workspaceScan('revealui', ['core'], T2));

    // Before the re-scan: both packages were contained.
    expect(await currentContains(T_MID)).toEqual([
      'revealui contains core',
      'revealui contains db',
    ]);
    // Now: only the surviving package.
    expect(await currentContains(NOW)).toEqual(['revealui contains core']);
  });

  it('re-scanning an unchanged scope is a no-op', async () => {
    await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T1));
    const again = await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T2));
    expect(again.edgeCount).toBe(0);
    expect(again.invalidatedEdgeIds).toHaveLength(0);
  });

  it('re-appearance after invalidation creates a new edge (fresh validity window)', async () => {
    await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T1));
    await applyScan(db.exec, workspaceScan('revealui', ['core'], T2));
    const reappear = await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], NOW));
    expect(reappear.edgeCount).toBe(1); // db's contains edge re-created
    const rows = await db.exec.query<{ count: string }>(
      `SELECT count(*) AS count FROM kg_edges WHERE fact = 'revealui contains db'`,
    );
    expect(Number(rows[0]?.count)).toBe(2); // one invalidated, one current
  });
});
