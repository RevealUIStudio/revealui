/**
 * Doc-currency drift detection (design spec §8.5): `kgDrift` walks CURRENT
 * `documents` edges (doc node -> code node, per the direction convention
 * documented in `search/drift.ts`) and reports the ones where the code node's
 * `last_confirmed_at` is newer than the doc's, sorted by staleness delta.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanEpisode } from '../extractors/shared.js';
import { ingestEpisode } from '../ingest/index.js';
import { kgDrift } from '../search/drift.js';
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
const DOC_KEY = 'revealui/docs/architecture/electric-sync.md';
const CODE_KEY = 'revealui/packages/sync/src/collab/kg-view.ts';
const OTHER_CODE_KEY = 'revealui/packages/sync/src/collab/use-kg-view-document.ts';

async function seedDoc(docConfirmedAt: Date, codeConfirmedAt: Date): Promise<void> {
  const nodes: NodeInput[] = [
    { kind: 'adr', name: 'electric-sync.md', naturalKey: DOC_KEY, repo: REPO },
    { kind: 'file', name: 'kg-view.ts', naturalKey: CODE_KEY, repo: REPO },
  ];
  const edge: EdgeInput = {
    source: { kind: 'adr', naturalKey: DOC_KEY },
    target: { kind: 'file', naturalKey: CODE_KEY },
    relation: 'documents',
    fact: 'electric-sync.md documents kg-view.ts',
    repo: REPO,
    validAt: docConfirmedAt,
  };

  // First episode establishes both nodes at the doc's confirmation time.
  await ingestEpisode(db.exec, {
    episode: scanEpisode({ repo: REPO, siteId: 's', now: docConfirmedAt }, 'docs-frontmatter'),
    nodes,
    edges: [edge],
  });

  // A later episode re-confirms only the code node (simulating a code scan
  // after the doc was last touched) — bump its last_confirmed_at without
  // touching the doc node or the edge.
  if (codeConfirmedAt.getTime() !== docConfirmedAt.getTime()) {
    await ingestEpisode(db.exec, {
      episode: scanEpisode({ repo: REPO, siteId: 's', now: codeConfirmedAt }, 'ts-project'),
      nodes: [{ kind: 'file', name: 'kg-view.ts', naturalKey: CODE_KEY, repo: REPO }],
      edges: [],
    });
  }
}

describe('kgDrift', () => {
  it('reports a doc whose documented code node was confirmed later', async () => {
    const docAt = new Date('2026-07-01T00:00:00Z');
    const codeAt = new Date('2026-07-10T00:00:00Z');
    await seedDoc(docAt, codeAt);

    const candidates = await kgDrift(db.exec);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.docNaturalKey).toBe(DOC_KEY);
    expect(candidates[0]?.codeNaturalKey).toBe(CODE_KEY);
    expect(candidates[0]?.deltaSeconds).toBeCloseTo(9 * 24 * 60 * 60, 0);
    expect(candidates[0]?.episodeIds.length).toBeGreaterThanOrEqual(1);
  });

  it('omits a doc that is at least as fresh as its documented code', async () => {
    const at = new Date('2026-07-01T00:00:00Z');
    await seedDoc(at, at);

    const candidates = await kgDrift(db.exec);
    expect(candidates).toHaveLength(0);
  });

  it('sorts multiple candidates by staleness delta descending', async () => {
    await seedDoc(new Date('2026-07-01T00:00:00Z'), new Date('2026-07-03T00:00:00Z'));

    const secondDocKey = 'revealui/docs/architecture/other.md';
    const nodes: NodeInput[] = [
      { kind: 'adr', name: 'other.md', naturalKey: secondDocKey, repo: REPO },
      { kind: 'file', name: 'use-kg-view-document.ts', naturalKey: OTHER_CODE_KEY, repo: REPO },
    ];
    const edge: EdgeInput = {
      source: { kind: 'adr', naturalKey: secondDocKey },
      target: { kind: 'file', naturalKey: OTHER_CODE_KEY },
      relation: 'documents',
      fact: 'other.md documents use-kg-view-document.ts',
      repo: REPO,
      validAt: new Date('2026-07-01T00:00:00Z'),
    };
    await ingestEpisode(db.exec, {
      episode: scanEpisode(
        { repo: REPO, siteId: 's', now: new Date('2026-07-01T00:00:00Z') },
        'docs-frontmatter',
        { doc: 'other' },
      ),
      nodes,
      edges: [edge],
    });
    await ingestEpisode(db.exec, {
      episode: scanEpisode(
        { repo: REPO, siteId: 's', now: new Date('2026-07-20T00:00:00Z') },
        'ts-project',
        { doc: 'other' },
      ),
      nodes: [
        { kind: 'file', name: 'use-kg-view-document.ts', naturalKey: OTHER_CODE_KEY, repo: REPO },
      ],
      edges: [],
    });

    const candidates = await kgDrift(db.exec);
    expect(candidates).toHaveLength(2);
    // The second (19-day delta) candidate ranks before the first (2-day delta).
    expect(candidates[0]?.docNaturalKey).toBe(secondDocKey);
    expect(candidates[1]?.docNaturalKey).toBe(DOC_KEY);
    expect(candidates[0]?.deltaSeconds).toBeGreaterThan(candidates[1]?.deltaSeconds ?? 0);
  });

  it('filters by repo when requested', async () => {
    await seedDoc(new Date('2026-07-01T00:00:00Z'), new Date('2026-07-10T00:00:00Z'));

    const inRepo = await kgDrift(db.exec, { repo: REPO });
    expect(inRepo).toHaveLength(1);

    const otherRepo = await kgDrift(db.exec, { repo: 'revdev' });
    expect(otherRepo).toHaveLength(0);
  });
});
