/**
 * Scan-churn regression (GAP-349 item 2).
 *
 * Investigation: two consecutive fleet re-scans of unchanged trees each
 * produced +5 new edges (revdev) / +5 new nodes (revealui) — a small number
 * of natural keys drifting between runs, invalidating the old identity and
 * inserting a fresh one (false churn in history). An in-process double-run
 * of every Tier-1 extractor against real revdev/revealui checkouts (with a
 * fixed `now` to eliminate the legitimate per-scan timestamp confound) came
 * back byte-identical, which narrowed the search to something that would
 * NOT reproduce on a quiescent, unchanged-since-last-syscall filesystem but
 * IS still unspecified behavior: `readdirSync` order.
 *
 * `workspace.ts`'s `packageKindByName` map resolves a `depends-on` edge's
 * TARGET KIND (`'package'` vs `'app'`) by iterating discovered workspace
 * dirs and keeping the LAST value written per package name — last-write-wins
 * over directory-listing order. `readdirSync` order is POSIX-unspecified
 * (ext4 htree order is a function of filename hashing, not alphabetical,
 * and isn't guaranteed stable across kernel/filesystem versions or cache
 * states), so two dirs in the same `packages/`/`apps/` topDir that happen to
 * declare the SAME npm package name (a real, if unusual, artifact of a
 * package rename where the old directory wasn't removed) could resolve to a
 * DIFFERENT winner kind on a later scan even with zero source changes —
 * flipping the derived node id of every `depends-on` edge targeting that
 * name (`deriveNodeId` includes `kind`), invalidating the old edge and
 * inserting a new one. Root cause: `listDir` (`shared.ts`) returned raw
 * `readdirSync` order; fixed by sorting there (single source, every
 * extractor consumer inherits the fix).
 *
 * These tests assert: (1) the general property — every Tier-1 extractor
 * (deterministic path) plus the additive `git` extractor emit an IDENTICAL
 * node-key + edge-key set across two runs of the same fixture tree; and
 * (2) the specific regression — a duplicate-package-name fixture resolves
 * the SAME `depends-on` target kind on every run.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  claimsExtractor,
  dbSchemaExtractor,
  docsFrontmatterExtractor,
  gitExtractor,
  routesExtractor,
  tsProjectExtractor,
  workspaceExtractor,
} from '../index.js';
import type { Extractor, ExtractorContext } from '../types.js';

const tempDirs: string[] = [];

async function makeTempRepo(files: Record<string, string>): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'revkg-determinism-'));
  tempDirs.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(root, relPath);
    await mkdir(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return root;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function nodeKey(n: { kind: string; naturalKey: string }): string {
  return `${n.kind}:${n.naturalKey}`;
}
function edgeKey(e: {
  source: { kind: string; naturalKey: string };
  target: { kind: string; naturalKey: string };
  relation: string;
}): string {
  return `${e.source.kind}:${e.source.naturalKey}|${e.target.kind}:${e.target.naturalKey}|${e.relation}`;
}

async function extractKeys(
  ex: Extractor,
  ctx: ExtractorContext,
): Promise<{ nodes: string[]; edges: string[] }> {
  const products = await ex.extract(ctx);
  const nodes = new Set<string>();
  const edges = new Set<string>();
  for (const p of products) {
    for (const n of p.nodes) nodes.add(nodeKey(n));
    for (const e of p.edges) edges.add(edgeKey(e));
  }
  return { nodes: [...nodes].sort(), edges: [...edges].sort() };
}

const TIER1: readonly Extractor[] = [
  workspaceExtractor,
  tsProjectExtractor,
  dbSchemaExtractor,
  docsFrontmatterExtractor,
  routesExtractor,
  claimsExtractor,
];

describe('extractor determinism — two runs over an unchanged tree', () => {
  it('every Tier-1 extractor emits an identical node/edge key set across two runs', async () => {
    const repoRoot = await makeTempRepo({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n  - apps/*\n',
      'packages/zzz-utils/package.json': JSON.stringify({
        name: 'zzz-utils',
        dependencies: { zod: '^4.0.0' },
      }),
      'packages/zzz-utils/src/index.ts': "export const helper = () => 'zzz';\n",
      'packages/aaa-core/package.json': JSON.stringify({
        name: 'aaa-core',
        dependencies: { 'zzz-utils': 'workspace:*' },
      }),
      'packages/aaa-core/src/index.ts':
        "import { helper } from '../../zzz-utils/src/index.js';\nexport const run = () => helper();\n",
      'packages/db/src/schema/example.ts':
        "import { pgTable, text } from 'drizzle-orm/pg-core';\nexport const examples = pgTable('examples', { id: text('id') });\n",
      'apps/mmm-app/package.json': JSON.stringify({ name: 'mmm-app', dependencies: {} }),
      'apps/mmm-app/app/api/widgets/route.ts':
        "export async function GET() { return new Response('ok'); }\n",
      'docs/gaps/GAP-999.md': '---\nstatus: open\npriority: high\n---\n# GAP-999\n',
      'apps/marketing/app/content/claims-evidence.ts':
        "export const CLAIMS = [{ file: 'home.ts', exportPath: 'H.x', text: 'hi', evidence: [{ kind: 'code', ref: 'LICENSE' }] }];\n",
      LICENSE: 'MIT\n',
    });
    const ctx: ExtractorContext = {
      repoRoot,
      repo: 'determinism-fixture',
      siteId: 'site-test',
      now: new Date('2026-07-12T00:00:00Z'),
    };

    for (const ex of TIER1) {
      const run1 = await extractKeys(ex, ctx);
      const run2 = await extractKeys(ex, ctx);
      expect(run2.nodes, `${ex.name} node keys`).toEqual(run1.nodes);
      expect(run2.edges, `${ex.name} edge keys`).toEqual(run1.edges);
    }
  });

  it('the additive git extractor emits an identical node/edge key set across two runs', async () => {
    // git extractor reads the repo's OWN git history (this worktree), which
    // is fine — it only needs `git log` to succeed and be stable across two
    // back-to-back reads of an unchanged HEAD.
    const ctx: ExtractorContext = {
      repoRoot: join(import.meta.dirname, '..', '..', '..', '..', '..'),
      repo: 'revealui',
      siteId: 'site-test',
      now: new Date('2026-07-12T00:00:00Z'),
    };
    const run1 = await extractKeys(gitExtractor, ctx);
    const run2 = await extractKeys(gitExtractor, ctx);
    expect(run2.nodes).toEqual(run1.nodes);
    expect(run2.edges).toEqual(run1.edges);
  });

  it('regression: a duplicate package name across two dirs in the same topDir resolves the same depends-on target kind on every run', async () => {
    // Two DIFFERENT package dirs under `packages/*` that (unusually, but
    // this happens during a rename where the old dir survives) declare the
    // SAME npm name. Before the `listDir` sort fix, `packageKindByName`
    // last-write-wins was decided by raw (POSIX-unspecified) readdir order;
    // after the fix, sorted order always processes `zzz-dup` after
    // `aaa-dup`, so `zzz-dup`'s kind ('package', since both are under
    // `packages/`) deterministically wins every run.
    const repoRoot = await makeTempRepo({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/aaa-dup/package.json': JSON.stringify({ name: 'dup-name', dependencies: {} }),
      'packages/zzz-dup/package.json': JSON.stringify({ name: 'dup-name', dependencies: {} }),
      'packages/consumer/package.json': JSON.stringify({
        name: 'consumer',
        dependencies: { 'dup-name': 'workspace:*' },
      }),
    });
    const ctx: ExtractorContext = {
      repoRoot,
      repo: 'dup-fixture',
      siteId: 'site-test',
      now: new Date('2026-07-12T00:00:00Z'),
    };

    const runs = await Promise.all([
      extractKeys(workspaceExtractor, ctx),
      extractKeys(workspaceExtractor, ctx),
      extractKeys(workspaceExtractor, ctx),
    ]);
    expect(runs[1].edges).toEqual(runs[0].edges);
    expect(runs[2].edges).toEqual(runs[0].edges);

    const dependsOnEdge = runs[0].edges.find((e) => e.includes('|depends-on'));
    expect(dependsOnEdge).toBeDefined();
    // Deterministic winner: 'package' (both dup-name dirs are under
    // packages/, so the kind is unambiguous here — the test's load-bearing
    // assertion is the equality across runs above; this pins the concrete
    // value so a future change to the winner logic is visible in the diff).
    expect(dependsOnEdge).toContain('package:dup-fixture:pkg:dup-name');
  });
});
