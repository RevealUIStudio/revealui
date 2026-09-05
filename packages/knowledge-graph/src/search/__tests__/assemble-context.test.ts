import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKgTestDb, type KgTestDb } from '../../__tests__/test-db.js';
import { ingestEpisode } from '../../ingest/index.js';
import { assembleContext } from '../assemble-context.js';

let db: KgTestDb;
beforeEach(async () => {
  db = await createKgTestDb();
});
afterEach(async () => {
  await db.close();
});

describe('assembleContext', () => {
  it('packs neighbor summaries and facts under the char budget', async () => {
    const episode = await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'agent-fact',
        source: 'test',
        siteId: 'test',
        content: 'lantern retry',
        referenceTime: new Date('2026-01-01T00:00:00Z'),
      },
      nodes: [
        { kind: 'concept', name: 'lantern', naturalKey: 'concept:lantern' },
        {
          kind: 'file',
          name: 'proxy.ts',
          naturalKey: 'revealui/apps/admin/src/lib/api/electric-proxy.ts',
        },
      ],
      edges: [
        {
          source: { kind: 'concept', naturalKey: 'concept:lantern' },
          target: {
            kind: 'file',
            naturalKey: 'revealui/apps/admin/src/lib/api/electric-proxy.ts',
          },
          relation: 'documents',
          fact: 'electric-proxy.ts retries with exponential backoff on 5xx',
        },
      ],
    });
    const nodeRows = await db.exec.query<{ id: string }>(
      `SELECT id FROM kg_nodes WHERE natural_key = $1`,
      ['concept:lantern'],
    );
    const anchorId = nodeRows[0]?.id;
    expect(anchorId).toBeTruthy();
    const assembled = await assembleContext(db.exec, anchorId as string, {
      charBudget: 16_000,
      depth: 2,
    });
    expect(assembled.truncated).toBe(false);
    expect(assembled.context).toContain('concept:lantern');
    expect(assembled.context).toContain('electric-proxy.ts retries');
    expect(assembled.context).toContain(episode.episodeId);
    expect(assembled.nodeCount).toBeGreaterThan(0);
    expect(assembled.factCount).toBeGreaterThan(0);
  });

  it('sets truncated when the budget cannot fit the packed block', async () => {
    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'agent-fact',
        source: 'test',
        siteId: 'test',
        content: 'tiny budget',
        referenceTime: new Date('2026-01-01T00:00:00Z'),
      },
      nodes: [{ kind: 'concept', name: 'lantern', naturalKey: 'concept:lantern' }],
      edges: [],
    });
    const nodeRows = await db.exec.query<{ id: string }>(
      `SELECT id FROM kg_nodes WHERE natural_key = $1`,
      ['concept:lantern'],
    );
    const assembled = await assembleContext(db.exec, nodeRows[0]?.id as string, {
      charBudget: 20,
      depth: 1,
    });
    expect(assembled.truncated).toBe(true);
    expect(assembled.charsUsed).toBeLessThanOrEqual(20);
  });
});
