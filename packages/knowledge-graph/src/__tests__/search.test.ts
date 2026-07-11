/**
 * Hybrid retrieval (spec §7): FTS node channel, traversal (BFS) channel,
 * fact/edge search with the episode-mentions reranker, and point-in-time facts.
 * The vector channel is not exercised here (no pgvector in PGlite); it is
 * skipped gracefully when no query embedding is supplied.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanEpisode } from '../extractors/shared.js';
import { deriveEdgeId, deriveNodeId } from '../ids.js';
import { applyOp, ingestEpisode } from '../ingest/index.js';
import { kgSearch } from '../search/index.js';
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
const FILE_KEY = 'revealui/packages/ai/src/llm/client.ts';
const T = new Date('2026-07-01T00:00:00Z');

const nodes: NodeInput[] = [
  {
    kind: 'file',
    name: 'client.ts',
    naturalKey: FILE_KEY,
    repo: REPO,
    summary: 'the LLM client factory',
  },
  { kind: 'symbol', name: 'getClient', naturalKey: `${FILE_KEY}#getClient`, repo: REPO },
  { kind: 'dependency', name: 'zod', naturalKey: 'npm:zod' },
];

const exportsEdge: EdgeInput = {
  source: { kind: 'file', naturalKey: FILE_KEY },
  target: { kind: 'symbol', naturalKey: `${FILE_KEY}#getClient` },
  relation: 'exports',
  fact: 'client.ts exports getClient',
  repo: REPO,
  validAt: T,
};
const importsEdge: EdgeInput = {
  source: { kind: 'file', naturalKey: FILE_KEY },
  target: { kind: 'dependency', naturalKey: 'npm:zod' },
  relation: 'imports',
  fact: 'client.ts imports zod',
  repo: REPO,
  validAt: T,
};

async function seed(): Promise<void> {
  await ingestEpisode(db.exec, {
    episode: scanEpisode({ repo: REPO, siteId: 's', now: T }, 'ts-project'),
    nodes,
    edges: [exportsEdge, importsEdge],
  });
}

describe('kgSearch', () => {
  it('finds nodes via the FTS channel', async () => {
    await seed();
    const result = await kgSearch(db.exec, { query: 'client' });
    expect(result.nodes.some((n) => n.naturalKey === FILE_KEY)).toBe(true);
  });

  it('finds facts (edges) via keyword search with provenance', async () => {
    await seed();
    const result = await kgSearch(db.exec, { query: 'exports getClient' });
    const fact = result.facts.find((f) => f.relation === 'exports');
    expect(fact).toBeDefined();
    expect(fact?.episodeIds.length).toBeGreaterThanOrEqual(1);
  });

  it('reaches connected nodes via the BFS anchor channel', async () => {
    await seed();
    const fileId = deriveNodeId('file', FILE_KEY);
    const result = await kgSearch(db.exec, { query: 'zod', anchor: fileId, bfsDepth: 2 });
    const zod = result.nodes.find((n) => n.naturalKey === 'npm:zod');
    expect(zod).toBeDefined();
    expect(zod?.distance).toBe(1);
  });

  it('the episode-mentions reranker counts distinct citing episodes', async () => {
    await seed();
    // A second episode citing the SAME exports edge (same id).
    await ingestEpisode(db.exec, {
      episode: scanEpisode(
        { repo: REPO, siteId: 's', now: new Date('2026-07-02T00:00:00Z') },
        'ts-project',
        { pass: 2 },
      ),
      nodes,
      edges: [exportsEdge],
    });
    const result = await kgSearch(db.exec, { query: 'exports getClient' });
    const fact = result.facts.find((f) => f.relation === 'exports');
    expect(fact?.mentions).toBe(2);
  });

  it('honors point-in-time predicates', async () => {
    await seed();
    const edgeId = deriveEdgeId(
      deriveNodeId('file', FILE_KEY),
      deriveNodeId('dependency', 'npm:zod'),
      'imports',
      T,
    );
    await applyOp(db.exec, { t: 'invalidate', edgeId, invalidAt: '2026-07-05T00:00:00Z' });

    const before = await kgSearch(db.exec, {
      query: 'imports zod',
      at: new Date('2026-07-03T00:00:00Z'),
    });
    expect(before.facts.some((f) => f.relation === 'imports')).toBe(true);

    const after = await kgSearch(db.exec, {
      query: 'imports zod',
      at: new Date('2026-07-10T00:00:00Z'),
    });
    expect(after.facts.some((f) => f.relation === 'imports')).toBe(false);
  });
});
