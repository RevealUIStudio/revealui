/**
 * Repo decommission — invalidate current edges; preserve pre-ice PIT history.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deriveNodeId } from '../ids.js';
import { applyScan, decommissionRepo } from '../ingest/index.js';
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
const ICE = new Date('2026-07-15T00:00:00Z');
const PRE_ICE = new Date('2026-07-10T00:00:00Z');
const POST_ICE = new Date('2026-07-20T00:00:00Z');

describe('decommissionRepo', () => {
  it('invalidates current edges for the repo at the ice date', async () => {
    await applyScan(db.exec, workspaceScan('revealcoin', ['core', 'db'], T1));
    const result = await decommissionRepo(db.exec, {
      repo: 'revealcoin',
      invalidAt: ICE,
      siteId: 'test-site',
      recordOutbox: false,
    });

    expect(result.edgeIds.length).toBeGreaterThan(0);
    expect(result.dryRun).toBe(false);

    const current = await db.exec.query<{ id: string }>(
      `SELECT id FROM kg_edges
       WHERE repo = 'revealcoin'
         AND (invalid_at IS NULL OR invalid_at > $1::timestamptz)`,
      [POST_ICE.toISOString()],
    );
    expect(current).toHaveLength(0);

    const iced = await db.exec.query<{ invalid_at: string }>(
      `SELECT invalid_at FROM kg_edges WHERE repo = 'revealcoin'`,
    );
    for (const row of iced) {
      expect(new Date(row.invalid_at).toISOString()).toBe(ICE.toISOString());
    }
  });

  it('preserves point-in-time facts before the ice date', async () => {
    await applyScan(db.exec, workspaceScan('revealcoin', ['core', 'db'], T1));
    await decommissionRepo(db.exec, {
      repo: 'revealcoin',
      invalidAt: ICE,
      siteId: 'test-site',
      recordOutbox: false,
    });

    const repoId = deriveNodeId('repo', 'revealcoin');
    const before = await kgAtTime(db.exec, repoId, PRE_ICE);
    const contains = before
      .filter((f) => f.relation === 'contains')
      .map((f) => f.fact)
      .sort();
    expect(contains).toEqual(['revealcoin contains core', 'revealcoin contains db']);

    const after = await kgAtTime(db.exec, repoId, POST_ICE);
    expect(after.filter((f) => f.relation === 'contains')).toHaveLength(0);
  });

  it('does not touch edges of another repo', async () => {
    await applyScan(db.exec, workspaceScan('revealcoin', ['core'], T1));
    await applyScan(db.exec, workspaceScan('revealui', ['core'], T1));
    await decommissionRepo(db.exec, {
      repo: 'revealcoin',
      invalidAt: ICE,
      siteId: 'test-site',
      recordOutbox: false,
    });

    const live = await db.exec.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM kg_edges
       WHERE repo = 'revealui'
         AND invalid_at IS NULL`,
    );
    expect(Number(live[0]?.count)).toBeGreaterThan(0);
  });

  it('dry-run reports ids without writing invalid_at', async () => {
    await applyScan(db.exec, workspaceScan('revealcoin', ['core'], T1));
    const result = await decommissionRepo(db.exec, {
      repo: 'revealcoin',
      invalidAt: ICE,
      siteId: 'test-site',
      dryRun: true,
      recordOutbox: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.edgeIds.length).toBeGreaterThan(0);

    const stillCurrent = await db.exec.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM kg_edges
       WHERE repo = 'revealcoin' AND invalid_at IS NULL`,
    );
    expect(Number(stillCurrent[0]?.count)).toBe(result.edgeIds.length);
  });

  it('rejects empty repo', async () => {
    await expect(decommissionRepo(db.exec, { repo: '  ', siteId: 'test-site' })).rejects.toThrow(
      /non-empty/,
    );
  });
});
