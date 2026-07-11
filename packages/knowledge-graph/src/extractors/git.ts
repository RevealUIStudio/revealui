/**
 * Git history extractor (Tier-1, additive).
 *
 * Reads recent commit subjects via git plumbing and links the repo to any
 * `GAP-NNN` token found in a commit subject via an `implements` edge, valid
 * at the commit's own timestamp. This extractor's product is additive
 * (commit history never gets invalidated by a later scan of the same repo),
 * so the integrator routes it through `ingestEpisode`, not `applyScan`.
 */

import { execFileSync } from 'node:child_process';
import type { EdgeInput, NodeInput } from '../types.js';
import { gapKey, repoKey, scanEpisode } from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

const COMMIT_LIMIT = 200;
const UNIT_SEPARATOR = '\x1f';

interface CommitRecord {
  sha: string;
  unixSeconds: number;
  subject: string;
}

function readCommits(repoRoot: string): CommitRecord[] {
  let raw: string;
  try {
    raw = execFileSync(
      'git',
      [
        '-C',
        repoRoot,
        'log',
        '--no-merges',
        '--pretty=format:%H%x1f%ct%x1f%s',
        '-n',
        String(COMMIT_LIMIT),
      ],
      { encoding: 'utf-8' },
    );
  } catch {
    return [];
  }

  const out: CommitRecord[] = [];
  for (const line of raw.split('\n')) {
    if (line.length === 0) continue;
    const parts = line.split(UNIT_SEPARATOR);
    const sha = parts[0];
    const tsRaw = parts[1];
    const subject = parts[2];
    if (!(sha && tsRaw) || subject === undefined) continue;
    const unixSeconds = Number(tsRaw);
    if (Number.isNaN(unixSeconds)) continue;
    out.push({ sha, unixSeconds, subject });
  }
  return out;
}

function isAllDigits(value: string): boolean {
  if (value.length === 0) return false;
  return [...value].every((c) => c >= '0' && c <= '9');
}

function findGapIds(subject: string): string[] {
  const ids: string[] = [];
  for (const token of subject.split(' ')) {
    if (token.length === 0 || !token.startsWith('GAP-')) continue;
    const rest = token.slice(4);
    if (isAllDigits(rest)) ids.push(token);
  }
  return ids;
}

export const gitExtractor: Extractor = {
  name: 'git',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const commits = readCommits(ctx.repoRoot);
    if (commits.length === 0) return [];

    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    const repoNode: NodeInput = {
      kind: 'repo',
      name: ctx.repo,
      naturalKey: repoKey(ctx.repo),
      repo: ctx.repo,
    };
    nodes.set(`${repoNode.kind}:${repoNode.naturalKey}`, repoNode);

    for (const commit of commits) {
      for (const gapId of findGapIds(commit.subject)) {
        const gapNode: NodeInput = {
          kind: 'gap',
          name: gapId,
          naturalKey: gapKey(gapId),
          repo: null,
        };
        const gapMapKey = `${gapNode.kind}:${gapNode.naturalKey}`;
        if (!nodes.has(gapMapKey)) nodes.set(gapMapKey, gapNode);

        edges.push({
          source: { kind: 'repo', naturalKey: repoKey(ctx.repo) },
          target: { kind: 'gap', naturalKey: gapKey(gapId) },
          relation: 'implements',
          fact: `${ctx.repo} commit ${commit.sha.slice(0, 7)} implements ${gapId}`,
          repo: ctx.repo,
          validAt: new Date(commit.unixSeconds * 1000),
        });
      }
    }

    if (edges.length === 0) return [];

    return [
      {
        episode: scanEpisode(ctx, 'git'),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'git' },
      },
    ];
  },
};
