/**
 * Reciprocal Rank Fusion + rerankers (spec §7).
 *
 * RRF combines the per-channel ranked lists (semantic, keyword, traversal) into
 * one ordering without needing calibrated scores: an item's fused score is the
 * sum over channels of `1 / (k + rank)`, k = 60 (the standard constant). Two
 * rerankers then adjust the fused order:
 *   - node-distance: closer to the anchor ranks higher (hop count from BFS).
 *   - episode-mentions: facts cited by more distinct episodes rank higher.
 *
 * Pure functions — unit-tested directly, no DB.
 */

export const RRF_K = 60;

/** Fuse ranked id lists into a combined score map. Rank is 0-based per list. */
export function rrfFuse(lists: string[][], k: number = RRF_K): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank];
      if (id === undefined) continue;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    }
  }
  return scores;
}

/** Order ids by fused score descending; ties broken by id for determinism. */
export function rankByScore(scores: Map<string, number>): Array<{ id: string; score: number }> {
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : a.id < b.id ? -1 : 1));
}

/** node-distance reranker: divide the fused score by (1 + hop distance from anchor). */
export function applyNodeDistance(score: number, distance: number | undefined): number {
  if (distance === undefined) return score;
  return score / (1 + distance);
}

/** episode-mentions reranker: boost by ln(1 + distinct episode count). */
export function applyEpisodeMentions(score: number, mentions: number): number {
  return score * (1 + Math.log1p(Math.max(0, mentions)));
}
