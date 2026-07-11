import { describe, expect, it } from 'vitest';
import { applyEpisodeMentions, applyNodeDistance, rankByScore, rrfFuse } from '../search/rrf.js';

describe('rrfFuse', () => {
  it('rewards items ranked highly across channels', () => {
    const scores = rrfFuse([
      ['a', 'b', 'c'],
      ['b', 'a', 'd'],
    ]);
    const ranked = rankByScore(scores);
    // 'b' is #1 and #2, 'a' is #2 and #1 — tie broken by id, both above c/d.
    expect(ranked[0]?.id === 'a' || ranked[0]?.id === 'b').toBe(true);
    const ids = ranked.map((r) => r.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
  });

  it('is deterministic on ties', () => {
    const a = rankByScore(rrfFuse([['x', 'y']]));
    const b = rankByScore(rrfFuse([['x', 'y']]));
    expect(a).toEqual(b);
  });
});

describe('rerankers', () => {
  it('node-distance demotes farther nodes', () => {
    expect(applyNodeDistance(1, 0)).toBe(1);
    expect(applyNodeDistance(1, 3)).toBeCloseTo(0.25);
    expect(applyNodeDistance(1, undefined)).toBe(1);
  });

  it('episode-mentions boosts more-cited facts', () => {
    expect(applyEpisodeMentions(1, 0)).toBe(1);
    expect(applyEpisodeMentions(1, 5)).toBeGreaterThan(applyEpisodeMentions(1, 1));
  });
});
