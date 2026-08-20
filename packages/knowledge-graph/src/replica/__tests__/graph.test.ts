/**
 * P5 graph.* replica — pull unpushed outbox ops, apply them on a peer
 * without echoing back to kg_outbox, and ack via graph.push.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { workspaceScan } from '../../__tests__/fixtures.js';
import { createKgTestDb, type KgTestDb, snapshot } from '../../__tests__/test-db.js';
import { applyScan } from '../../ingest/index.js';
import { GRAPH_METHODS, graphApply, graphPull, graphPush, handleGraphMethod } from '../graph.js';
import { parseKgOp } from '../ops.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

const T1 = new Date('2026-07-01T00:00:00Z');

describe('GRAPH_METHODS', () => {
  it('names the daemon replica surface', () => {
    expect(GRAPH_METHODS.pull).toBe('graph.pull');
    expect(GRAPH_METHODS.apply).toBe('graph.apply');
    expect(GRAPH_METHODS.push).toBe('graph.push');
  });
});

describe('graph.pull / graph.push', () => {
  it('returns unpushed outbox ops in seq order', async () => {
    const result = await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T1), {
      recordOutbox: true,
    });
    expect(result.ops.length).toBeGreaterThan(0);

    const pulled = await graphPull(db.exec, {});
    expect(pulled.entries.length).toBe(result.ops.length);
    expect(pulled.entries[0]?.seq).toBe(1);
    expect(pulled.nextSeq).toBe(result.ops.length);
    expect(pulled.entries.every((e) => e.op.t !== undefined)).toBe(true);
  });

  it('graph.push marks rows so a later pull is empty', async () => {
    await applyScan(db.exec, workspaceScan('revealui', ['core'], T1), { recordOutbox: true });
    const pulled = await graphPull(db.exec, {});
    expect(pulled.entries.length).toBeGreaterThan(0);

    const dry = await graphPush(db.exec, { untilSeq: pulled.nextSeq, dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(dry.marked).toBe(pulled.entries.length);
    const still = await graphPull(db.exec, {});
    expect(still.entries.length).toBe(pulled.entries.length);

    const acked = await graphPush(db.exec, { untilSeq: pulled.nextSeq });
    expect(acked.dryRun).toBe(false);
    expect(acked.marked).toBe(pulled.entries.length);
    const after = await graphPull(db.exec, {});
    expect(after.entries).toEqual([]);
  });
});

describe('graph.apply', () => {
  it('dry-run validates ops and writes nothing', async () => {
    const source = await applyScan(db.exec, workspaceScan('revealui', ['core'], T1), {
      recordOutbox: true,
    });
    const peer = await createKgTestDb();
    try {
      const preview = await graphApply(peer.exec, { ops: source.ops, dryRun: true });
      expect(preview.dryRun).toBe(true);
      expect(preview.applied).toBe(source.ops.length);
      const nodes = await peer.exec.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM kg_nodes`,
      );
      expect(Number(nodes[0]?.count)).toBe(0);
    } finally {
      await peer.close();
    }
  });

  it('applies remote ops without echoing to the peer outbox and converges', async () => {
    const source = await applyScan(db.exec, workspaceScan('revealui', ['core', 'db'], T1), {
      recordOutbox: true,
    });
    const peer = await createKgTestDb();
    try {
      const applied = await graphApply(peer.exec, { ops: source.ops });
      expect(applied.dryRun).toBe(false);
      expect(applied.applied).toBe(source.ops.length);

      const peerOutbox = await peer.exec.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM kg_outbox`,
      );
      expect(Number(peerOutbox[0]?.count)).toBe(0);

      expect(await snapshot(peer.exec)).toEqual(await snapshot(db.exec));
    } finally {
      await peer.close();
    }
  });

  it('rejects an invalid op before applying any of the batch', async () => {
    const source = await applyScan(db.exec, workspaceScan('revealui', ['core'], T1), {
      recordOutbox: true,
    });
    const peer = await createKgTestDb();
    try {
      await expect(
        graphApply(peer.exec, {
          ops: [...source.ops, { t: 'invalidate', edgeId: '', invalidAt: 'nope' }],
        }),
      ).rejects.toThrow();
      const nodes = await peer.exec.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM kg_nodes`,
      );
      expect(Number(nodes[0]?.count)).toBe(0);
    } finally {
      await peer.close();
    }
  });
});

describe('handleGraphMethod', () => {
  it('dispatches graph.pull / graph.apply / graph.push by method name', async () => {
    const result = await applyScan(db.exec, workspaceScan('revealui', ['core'], T1), {
      recordOutbox: true,
    });
    const pulled = (await handleGraphMethod(GRAPH_METHODS.pull, {}, db.exec)) as {
      entries: Array<{ op: unknown }>;
    };
    expect(pulled.entries.length).toBe(result.ops.length);

    await expect(handleGraphMethod('graph.unknown', {}, db.exec)).rejects.toThrow(/unknown/);
  });
});

describe('parseKgOp', () => {
  it('accepts a real scan op and rejects unknown t', () => {
    const op = {
      t: 'invalidate',
      edgeId: 'aaaaaaaa-bbbb-5ccc-8ddd-eeeeeeeeeeee',
      invalidAt: '2026-07-01T00:00:00.000Z',
    };
    expect(parseKgOp(op).t).toBe('invalidate');
    expect(() => parseKgOp({ t: 'explode' })).toThrow();
  });
});
