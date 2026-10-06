import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deriveEpisodeId } from '../ids.js';
import type { EpisodeIngestInput } from '../ingest/engine.js';
import { auditLegacyMemory, ingestEpisode } from '../ingest/index.js';
import { applyOps } from '../ingest/merge.js';
import { MEMORY_SCHEMA } from '../memory/types.js';
import { graphApply } from '../replica/graph.js';
import type { KgOp } from '../types.js';
import { createKgTestDb, type KgTestDb, snapshot } from './test-db.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

function input(classification = 'private', tenantId = 'acct-a'): EpisodeIngestInput {
  return {
    episode: {
      episodeType: 'memory',
      source: 'agent:did:revealfleet:actor:fp',
      siteId: 'test',
      content: 'secret episode',
      referenceTime: new Date('2026-10-06T00:00:00Z'),
      contentRef: {
        schema: MEMORY_SCHEMA,
        actorDid: 'did:revealfleet:actor:fp',
        scope: { tenantId, classification },
      },
    },
    nodes: [
      { kind: 'file', name: 'secret name', naturalKey: 'shared.ts', summary: 'secret summary' },
    ],
    edges: [],
  };
}

/** Represents the historical outbox format, before immutable snapshots. */
function historicalOps(ops: KgOp[]): KgOp[] {
  return ops.map((op) => {
    if (op.t !== 'episode') return op;
    const { ingestSnapshot: _snapshot, ...ref } = op.row.content_ref;
    const id = deriveEpisodeId({
      episodeType: op.row.episode_type,
      source: op.row.source,
      contentRef: ref,
      referenceTime: new Date(op.row.reference_time),
    });
    return { ...op, id, row: { ...op.row, id, content_ref: ref } };
  });
}

describe('legacy memory provenance', () => {
  it('preserves authored node-only payloads despite later cross-scope node merges', async () => {
    const first = await ingestEpisode(db.exec, input());
    const next = input('workspace', 'acct-b');
    next.nodes[0]!.summary = 'different scope';
    await ingestEpisode(db.exec, next);
    const rows = await db.exec.query<{
      content_ref: { ingestSnapshot: { nodes: Array<{ summary: string }> } };
    }>('SELECT content_ref FROM kg_episodes WHERE id = $1', [first.episodeId]);
    expect(rows[0]?.content_ref.ingestSnapshot.nodes[0]?.summary).toBe('secret summary');
    const report = await auditLegacyMemory(db.exec);
    expect(report.findings).toHaveLength(2);
    expect(
      report.findings.every(
        (f) => f.blocker === 'reconstruction-required' && f.snapshotNodes === 1,
      ),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/secret|acct-a|actor:fp/);
  });

  it('retains snapshots across replica apply without requiring a peer outbox', async () => {
    const result = await ingestEpisode(db.exec, input());
    const peer = await createKgTestDb();
    try {
      await graphApply(peer.exec, { ops: result.ops });
      expect(await auditLegacyMemory(peer.exec)).toEqual(await auditLegacyMemory(db.exec));
      expect(await snapshot(peer.exec)).toEqual(await snapshot(db.exec));
    } finally {
      await peer.close();
    }
  });

  it('does not infer ownership from historical outbox order or merged nodes', async () => {
    const result = await ingestEpisode(db.exec, input());
    await applyOps(db.exec, historicalOps(result.ops), { recordOutbox: true, siteId: 'test' });
    const findings = (await auditLegacyMemory(db.exec)).findings;
    expect(findings.filter((f) => f.blocker === 'missing-authoritative-snapshot')).toHaveLength(1);
  });

  it('is read-only and idempotent, and excludes already scoped and scan episodes', async () => {
    const legacy = await ingestEpisode(db.exec, input());
    const scoped = input();
    scoped.episode.contentRef!.keyScopeVersion = 1;
    await ingestEpisode(db.exec, scoped);
    const scan = input();
    scan.episode.episodeType = 'code-scan';
    scan.episode.contentRef = { extractor: 'test' };
    await ingestEpisode(db.exec, scan);
    const before = await snapshot(db.exec);
    const report = await auditLegacyMemory(db.exec);
    expect(report.findings.map((f) => f.episodeId)).toEqual([legacy.episodeId]);
    expect(await auditLegacyMemory(db.exec)).toEqual(report);
    expect(await snapshot(db.exec)).toEqual(before);
  });

  it('rejects a snapshot patched into an existing episode without its content-addressed identity', async () => {
    const result = await ingestEpisode(db.exec, input());
    await db.exec.query(
      `UPDATE kg_episodes SET content_ref = jsonb_set(content_ref,
      '{ingestSnapshot,nodes,0,summary}', '"tampered"') WHERE id = $1`,
      [result.episodeId],
    );
    expect((await auditLegacyMemory(db.exec)).findings[0]?.blocker).toBe(
      'invalid-authoritative-snapshot',
    );
  });

  it('commits the snapshot and node writes together and replays idempotently', async () => {
    const first = await ingestEpisode(db.exec, input());
    const before = await snapshot(db.exec);
    expect((await ingestEpisode(db.exec, input())).episodeId).toBe(first.episodeId);
    expect(await snapshot(db.exec)).toEqual(before);
    const failing = input('workspace');
    failing.nodes[0]!.name = 'will roll back';
    const exec = db.exec;
    await expect(
      ingestEpisode(
        {
          ...exec,
          transaction: (fn) =>
            exec.transaction((tx) =>
              fn({
                ...tx,
                query: async (sql, params) => {
                  if (sql.startsWith('INSERT INTO kg_nodes')) throw new Error('storage failure');
                  return tx.query(sql, params);
                },
              }),
            ),
        },
        failing,
      ),
    ).rejects.toThrow('storage failure');
    expect(await snapshot(db.exec)).toEqual(before);
  });

  it('keeps edge provenance on the snapshot-addressed episode', async () => {
    const data = input();
    data.nodes.push({ kind: 'file', name: 'other', naturalKey: 'other.ts' });
    data.edges.push({
      source: { kind: 'file', naturalKey: 'shared.ts' },
      target: { kind: 'file', naturalKey: 'other.ts' },
      relation: 'relates-to',
      fact: 'secret relation',
    });
    const result = await ingestEpisode(db.exec, data);
    expect(result.ops.filter((op) => op.t === 'edge').map((op) => op.episodeIds)).toEqual([
      [result.episodeId],
    ]);
    expect((await auditLegacyMemory(db.exec)).findings[0]).toMatchObject({
      snapshotNodes: 2,
      snapshotEdges: 1,
      connectedNodes: 2,
      blocker: 'reconstruction-required',
    });
  });
});
