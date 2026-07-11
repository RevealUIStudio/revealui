/**
 * Test fixtures: small deterministic scan products + op permutation.
 */

import { scanEpisode } from '../extractors/shared.js';
import type { ScanInput } from '../ingest/engine.js';
import type { KgOp } from '../types.js';

const SITE = 'site-A';

export function workspaceScan(repo: string, packages: string[], now: Date): ScanInput {
  return {
    episode: scanEpisode({ repo, siteId: SITE, now }, 'workspace'),
    nodes: [
      { kind: 'repo', name: repo, naturalKey: repo, repo },
      ...packages.map((p) => ({
        kind: 'package' as const,
        name: p,
        naturalKey: `${repo}:pkg:${p}`,
        repo,
      })),
    ],
    edges: packages.map((p) => ({
      source: { kind: 'repo' as const, naturalKey: repo },
      target: { kind: 'package' as const, naturalKey: `${repo}:pkg:${p}` },
      relation: 'contains' as const,
      fact: `${repo} contains ${p}`,
      repo,
    })),
    scope: { repo, extractor: 'workspace' },
  };
}

/**
 * A different interleaving that still respects the causal/FK constraints
 * (endpoint nodes + episodes before edges, edges before invalidations). Because
 * every op is class-1/2, this must converge to the same state as the natural
 * order emitted by `applyScan`.
 */
export function permuteOps(ops: KgOp[]): KgOp[] {
  const nodes = ops.filter((o) => o.t === 'node').reverse();
  const episodes = ops.filter((o) => o.t === 'episode');
  const edges = ops.filter((o) => o.t === 'edge').reverse();
  const rest = ops.filter((o) => o.t !== 'node' && o.t !== 'episode' && o.t !== 'edge');
  return [...nodes, ...episodes, ...edges, ...rest];
}

const isType =
  (t: KgOp['t']) =>
  (o: KgOp): boolean =>
    o.t === t;

/**
 * Interleave two scan batches so the SECOND batch's node upserts are applied
 * BEFORE the first batch's (while keeping FK/causal order: nodes → episodes →
 * edges → invalidations). This reorders monotonic upserts across batches, so it
 * only converges to the same state as the natural order if `first_seen_at` is a
 * genuine min-wins register (`LEAST`). A last-writer merge would diverge.
 */
export function crossBatchInterleave(batch1: KgOp[], batch2: KgOp[]): KgOp[] {
  const pick = (ops: KgOp[], t: KgOp['t']): KgOp[] => ops.filter(isType(t));
  const notCore = (o: KgOp): boolean => o.t !== 'node' && o.t !== 'episode' && o.t !== 'edge';
  return [
    ...pick(batch2, 'node'),
    ...pick(batch1, 'node'),
    ...pick(batch1, 'episode'),
    ...pick(batch2, 'episode'),
    ...pick(batch1, 'edge'),
    ...pick(batch2, 'edge'),
    ...batch1.filter(notCore),
    ...batch2.filter(notCore),
  ];
}
