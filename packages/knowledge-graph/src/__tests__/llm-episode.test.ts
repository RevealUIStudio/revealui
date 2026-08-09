import { describe, expect, it } from 'vitest';
import { extractEpisodeFromText } from '../extractors/llm-episode.js';

describe('extractEpisodeFromText', () => {
  it('maps valid model JSON to EpisodeIngestInput', async () => {
    const complete = async () =>
      JSON.stringify({
        nodes: [
          {
            kind: 'gap',
            name: 'GAP-349',
            naturalKey: 'gap:GAP-349',
            summary: 'Fleet knowledge graph',
          },
        ],
        edges: [
          {
            sourceKind: 'gap',
            sourceNaturalKey: 'gap:GAP-349',
            targetKind: 'package',
            targetNaturalKey: 'revealui/packages/knowledge-graph',
            relation: 'depends-on',
            fact: 'GAP-349 owns @revealui/knowledge-graph',
          },
        ],
      });

    const { extraction, ingest } = await extractEpisodeFromText('note about GAP-349', {
      complete,
      source: 'test-session',
      siteId: 'test-host',
    });

    expect(extraction.nodes).toHaveLength(1);
    expect(ingest.nodes[0]?.naturalKey).toBe('gap:GAP-349');
    expect(ingest.edges[0]?.relation).toBe('depends-on');
    expect(ingest.episode.episodeType).toBe('agent-fact');
  });

  it('rejects invalid model JSON shape (prove-red for bad completer)', async () => {
    await expect(
      extractEpisodeFromText('x', {
        complete: async () => JSON.stringify({ nodes: [{ kind: 'gap' }] }),
        source: 't',
        siteId: 'h',
      }),
    ).rejects.toThrow();
  });

  it('clips long input before calling completer', async () => {
    let seen = '';
    await extractEpisodeFromText('y'.repeat(50_000), {
      complete: async (_p, user) => {
        seen = user;
        return JSON.stringify({ nodes: [], edges: [] });
      },
      source: 't',
      siteId: 'h',
      maxInputChars: 100,
    });
    expect(seen.length).toBe(100);
  });

  it('derives naturalKey from name when model omits it', async () => {
    const complete = async () =>
      JSON.stringify({
        nodes: [{ kind: 'gap', name: 'GAP-349' }],
        edges: [],
      });
    const { extraction } = await extractEpisodeFromText('x', {
      complete,
      source: 't',
      siteId: 'h',
    });
    expect(extraction.nodes[0]?.naturalKey).toBe('concept:gap-349');
  });

  it('maps unknown kinds/relations to concept/relates-to', async () => {
    const complete = async () =>
      JSON.stringify({
        nodes: [
          {
            kind: 'not-a-real-kind',
            name: 'x',
            naturalKey: 'concept:x',
          },
        ],
        edges: [
          {
            sourceKind: 'not-a-real-kind',
            sourceNaturalKey: 'concept:x',
            targetKind: 'gap',
            targetNaturalKey: 'gap:GAP-349',
            relation: 'invented-rel',
            fact: 'x invented',
          },
        ],
      });

    const { extraction } = await extractEpisodeFromText('x', {
      complete,
      source: 't',
      siteId: 'h',
    });
    expect(extraction.nodes[0]?.kind).toBe('concept');
    expect(extraction.edges[0]?.sourceKind).toBe('concept');
    expect(extraction.edges[0]?.relation).toBe('relates-to');
  });

  it('coerces null optional repo/summary from model JSON', async () => {
    const complete = async () =>
      JSON.stringify({
        nodes: [
          {
            kind: 'concept',
            name: 'x',
            naturalKey: 'concept:x',
            repo: null,
            summary: null,
          },
        ],
        edges: [
          {
            sourceKind: 'concept',
            sourceNaturalKey: 'concept:x',
            targetKind: 'gap',
            targetNaturalKey: 'gap:GAP-349',
            relation: 'relates-to',
            fact: 'x relates to GAP-349',
            repo: null,
          },
        ],
      });

    const { extraction, ingest } = await extractEpisodeFromText('x', {
      complete,
      source: 't',
      siteId: 'h',
    });
    expect(extraction.nodes[0]?.repo).toBeUndefined();
    expect(ingest.nodes[0]?.repo).toBeUndefined();
    expect(ingest.edges[0]?.repo).toBeUndefined();
  });
});
