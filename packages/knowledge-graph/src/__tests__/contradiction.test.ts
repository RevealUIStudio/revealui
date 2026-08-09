import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findContradictingEdges,
  invalidateContradictions,
  naturalKeysSimilar,
  normalizeNaturalKey,
} from '../ingest/contradiction.js';
import { ingestEpisode } from '../ingest/engine.js';
import { createKgTestDb, type KgTestDb } from './test-db.js';

describe('natural key similarity', () => {
  it('normalizes separators', () => {
    expect(normalizeNaturalKey('Foo/Bar_Baz')).toBe('foo-bar-baz');
    expect(naturalKeysSimilar('Foo/Bar', 'foo-bar')).toBe(true);
  });
});

describe('invalidateContradictions', () => {
  let db: KgTestDb;

  beforeEach(async () => {
    db = await createKgTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  it('invalidates current edges with same endpoints+relation but different fact', async () => {
    const t0 = new Date('2026-08-01T00:00:00.000Z');
    const t1 = new Date('2026-08-09T00:00:00.000Z');

    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'manual',
        source: 'test-old',
        siteId: 'test',
        referenceTime: t0,
      },
      nodes: [
        { kind: 'package', name: 'kg', naturalKey: 'pkg/kg' },
        { kind: 'gap', name: 'GAP-349', naturalKey: 'gap:GAP-349' },
      ],
      edges: [
        {
          source: { kind: 'gap', naturalKey: 'gap:GAP-349' },
          target: { kind: 'package', naturalKey: 'pkg/kg' },
          relation: 'depends-on',
          fact: 'old claim',
          validAt: t0,
        },
      ],
    });

    const newEdge = {
      source: { kind: 'gap' as const, naturalKey: 'gap:GAP-349' },
      target: { kind: 'package' as const, naturalKey: 'pkg/kg' },
      relation: 'depends-on' as const,
      fact: 'new claim',
      validAt: t1,
    };

    const hits = await findContradictingEdges(db.exec, newEdge, { at: t1 });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]?.fact).toBe('old claim');

    const invalidated = await invalidateContradictions(db.exec, [newEdge], {
      siteId: 'test',
      invalidAt: t1,
      recordOutbox: false,
    });
    expect(invalidated.length).toBeGreaterThanOrEqual(1);

    const after = await findContradictingEdges(db.exec, newEdge, { at: t1 });
    expect(after).toHaveLength(0);
  });

  it('ingestEpisode with invalidateContradictions opts in', async () => {
    const t0 = new Date('2026-08-01T00:00:00.000Z');
    const t1 = new Date('2026-08-09T00:00:00.000Z');

    await ingestEpisode(db.exec, {
      episode: {
        episodeType: 'manual',
        source: 'test-old',
        siteId: 'test',
        referenceTime: t0,
      },
      nodes: [
        { kind: 'package', name: 'kg', naturalKey: 'pkg/kg' },
        { kind: 'gap', name: 'GAP-349', naturalKey: 'gap:GAP-349' },
      ],
      edges: [
        {
          source: { kind: 'gap', naturalKey: 'gap:GAP-349' },
          target: { kind: 'package', naturalKey: 'pkg/kg' },
          relation: 'depends-on',
          fact: 'old claim',
          validAt: t0,
        },
      ],
    });

    const result = await ingestEpisode(
      db.exec,
      {
        episode: {
          episodeType: 'manual',
          source: 'test-new',
          siteId: 'test',
          referenceTime: t1,
        },
        nodes: [
          { kind: 'package', name: 'kg', naturalKey: 'pkg/kg' },
          { kind: 'gap', name: 'GAP-349', naturalKey: 'gap:GAP-349' },
        ],
        edges: [
          {
            source: { kind: 'gap', naturalKey: 'gap:GAP-349' },
            target: { kind: 'package', naturalKey: 'pkg/kg' },
            relation: 'depends-on',
            fact: 'new claim',
            validAt: t1,
          },
        ],
      },
      { invalidateContradictions: true, recordOutbox: false },
    );

    expect(result.invalidatedEdgeIds.length).toBeGreaterThanOrEqual(1);
  });
});
