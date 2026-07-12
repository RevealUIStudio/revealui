/**
 * Per-episode transactional application (spec §6). `applyScan`/`ingestEpisode`
 * wrap their op batch — episode, node, edge, and invalidation ops, plus their
 * outbox writes — in one `KgExecutor.transaction`. A failing op mid-batch must
 * roll back everything already written in that batch, not just the failing op.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanEpisode } from '../extractors/shared.js';
import { deriveNodeId } from '../ids.js';
import { ingestEpisode } from '../ingest/index.js';
import type { EdgeInput, NodeInput } from '../types.js';
import { createKgTestDb, type KgTestDb } from './test-db.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

const REPO = 'revealui';
const T = new Date('2026-07-01T00:00:00Z');

async function tableCount(table: string): Promise<number> {
  const rows = await db.exec.query<{ count: string }>(`SELECT count(*) AS count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
}

describe('transactional application', () => {
  it('a failing op mid-batch leaves no partial episode/nodes/edges committed', async () => {
    const validFileKey = 'revealui/packages/ai/src/llm/client.ts';
    // A valid node in the batch...
    const nodes: NodeInput[] = [
      { kind: 'file', name: 'client.ts', naturalKey: validFileKey, repo: REPO },
    ];
    // ...paired with an edge whose target references a node NOT included in
    // this batch, so the kg_edges.target_id FK violates and the INSERT throws
    // partway through the op loop (after the episode + file node already
    // succeeded, on the same connection/transaction).
    const edges: EdgeInput[] = [
      {
        source: { kind: 'file', naturalKey: validFileKey },
        target: { kind: 'dependency', naturalKey: 'npm:does-not-exist' },
        relation: 'imports',
        fact: 'client.ts imports a node that was never upserted',
        repo: REPO,
        validAt: T,
      },
    ];

    await expect(
      ingestEpisode(db.exec, {
        episode: scanEpisode({ repo: REPO, siteId: 's', now: T }, 'ts-project'),
        nodes,
        edges,
      }),
    ).rejects.toThrow();

    // Nothing from the batch persisted: the episode and the file node — both
    // of which succeeded on their own before the edge insert failed — were
    // rolled back along with it.
    expect(await tableCount('kg_episodes')).toBe(0);
    expect(await tableCount('kg_nodes')).toBe(0);
    expect(await tableCount('kg_edges')).toBe(0);
    expect(
      await db.exec.query(`SELECT id FROM kg_nodes WHERE natural_key = $1`, [validFileKey]),
    ).toHaveLength(0);
  });

  it('rolls back an earlier write in the same transaction when a later op fails', async () => {
    const key = 'revealui/packages/ai/src/llm/client.ts';
    const nodeId = deriveNodeId('file', key);

    await expect(
      db.exec.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO kg_nodes (id, kind, name, natural_key, first_seen_at, last_confirmed_at)
           VALUES ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz)`,
          [nodeId, 'file', 'client.ts', key, T.toISOString()],
        );
        // FK violation: no such edge/episode row exists.
        await tx.query(`INSERT INTO kg_edge_episodes (edge_id, episode_id) VALUES ($1, $2)`, [
          'does-not-exist',
          'does-not-exist',
        ]);
      }),
    ).rejects.toThrow();

    expect(await tableCount('kg_nodes')).toBe(0);
  });

  it('a successful transaction commits every op in the batch', async () => {
    const key = 'revealui/packages/ai/src/llm/client.ts';
    await db.exec.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO kg_nodes (id, kind, name, natural_key, first_seen_at, last_confirmed_at)
         VALUES ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz)`,
        [deriveNodeId('file', key), 'file', 'client.ts', key, T.toISOString()],
      );
    });
    expect(await tableCount('kg_nodes')).toBe(1);
  });
});
