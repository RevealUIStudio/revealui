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
        complete: async () => JSON.stringify({ nodes: [{ kind: 'not-a-kind' }] }),
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
});
