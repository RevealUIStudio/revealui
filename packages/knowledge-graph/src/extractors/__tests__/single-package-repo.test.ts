/**
 * Fleet scan hardening (GAP-349): coverage for non-pnpm-monorepo fleet repos.
 *
 * Before this fix, `workspaceExtractor`/`tsProjectExtractor` only discovered
 * scan targets via `pnpm-workspace.yaml` membership, so a fleet repo with no
 * workspace file (e.g. a bare Vite SPA checkout like `agency`) produced only
 * the bare repo node and zero file/symbol coverage ("agency: 1 nodes, 0
 * edges" from the first `revkg scan --fleet` run). These fixtures exercise
 * the three shapes observed across the fleet: a single-package repo with a
 * real TS `src` tree, a repo with a `package.json` but no TS, and a bare
 * directory with neither.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deriveNodeId } from '../../ids.js';
import { packageKey, repoKey } from '../shared.js';
import { tsProjectExtractor } from '../ts-project.js';
import type { ExtractorContext } from '../types.js';
import { workspaceExtractor } from '../workspace.js';

const tempDirs: string[] = [];

async function makeTempRepo(files: Record<string, string>): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'revkg-single-pkg-'));
  tempDirs.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(root, relPath);
    await mkdir(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return root;
}

function ctxFor(repoRoot: string, repo: string): ExtractorContext {
  return { repoRoot, repo, siteId: 'site-test', now: new Date('2026-07-11T00:00:00Z') };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('single-package (non-monorepo) repo fallback', () => {
  it('extracts file + symbol nodes for a single-package repo with a tsconfig and src tree', async () => {
    const repoRoot = await makeTempRepo({
      'package.json': JSON.stringify({ name: 'agency', version: '0.1.0' }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
      'src/index.ts': "export const greeting = 'hello';\n",
    });
    const ctx = ctxFor(repoRoot, 'agency');

    const [wsProduct] = await workspaceExtractor.extract(ctx);
    expect(wsProduct).toBeDefined();
    const wsKinds = wsProduct?.nodes.map((n) => `${n.kind}:${n.naturalKey}`) ?? [];
    expect(wsKinds).toContain(`repo:${repoKey('agency')}`);
    expect(wsKinds).toContain(`package:${packageKey('agency', 'agency')}`);
    expect(wsProduct?.edges).toEqual([
      expect.objectContaining({
        source: { kind: 'repo', naturalKey: repoKey('agency') },
        target: { kind: 'package', naturalKey: packageKey('agency', 'agency') },
        relation: 'contains',
      }),
    ]);

    const [tsProduct] = await tsProjectExtractor.extract(ctx);
    expect(tsProduct).toBeDefined();
    const fileNode = tsProduct?.nodes.find((n) => n.kind === 'file');
    expect(fileNode?.naturalKey).toBe('agency/src/index.ts');
    const symbolNode = tsProduct?.nodes.find((n) => n.kind === 'symbol');
    expect(symbolNode?.name).toBe('greeting');
    expect(symbolNode?.naturalKey).toBe('agency/src/index.ts#greeting');

    // The ts-project `contains` edge must originate from the SAME package
    // natural key the workspace extractor emitted, so the two Tier-1
    // extractors converge on one deterministic node id for the package.
    const containsEdge = tsProduct?.edges.find((e) => e.relation === 'contains');
    expect(containsEdge?.source).toEqual({
      kind: 'package',
      naturalKey: packageKey('agency', 'agency'),
    });
  });

  it('yields the repo + implicit package node but zero file/symbol nodes for a repo with package.json and no TS', async () => {
    const repoRoot = await makeTempRepo({
      'package.json': JSON.stringify({ name: 'status', version: '0.1.0' }),
      'README.md': '# status\n',
    });
    const ctx = ctxFor(repoRoot, 'status');

    const [wsProduct] = await workspaceExtractor.extract(ctx);
    const wsKinds = wsProduct?.nodes.map((n) => `${n.kind}:${n.naturalKey}`) ?? [];
    expect(wsKinds).toContain(`repo:${repoKey('status')}`);
    expect(wsKinds).toContain(`package:${packageKey('status', 'status')}`);

    const tsProducts = await tsProjectExtractor.extract(ctx);
    expect(tsProducts).toEqual([]);
  });

  it('does not error on a bare directory with neither package.json nor TS, and still yields the repo node', async () => {
    const repoRoot = await makeTempRepo({
      '.gitkeep': '',
    });
    const ctx = ctxFor(repoRoot, 'scripts');

    const [wsProduct] = await workspaceExtractor.extract(ctx);
    expect(wsProduct).toBeDefined();
    const repoNode = wsProduct?.nodes.find((n) => n.kind === 'repo');
    expect(repoNode?.naturalKey).toBe(repoKey('scripts'));

    await expect(tsProjectExtractor.extract(ctx)).resolves.toEqual([]);
  });

  it('derives distinct node ids for implicit single-package repos with the same package name in different repos', async () => {
    const repoA = await makeTempRepo({ 'package.json': JSON.stringify({ name: 'shared-name' }) });
    const repoB = await makeTempRepo({ 'package.json': JSON.stringify({ name: 'shared-name' }) });

    const [productA] = await workspaceExtractor.extract(ctxFor(repoA, 'repo-a'));
    const [productB] = await workspaceExtractor.extract(ctxFor(repoB, 'repo-b'));

    const pkgNodeA = productA?.nodes.find((n) => n.kind === 'package');
    const pkgNodeB = productB?.nodes.find((n) => n.kind === 'package');
    expect(pkgNodeA?.naturalKey).not.toBe(pkgNodeB?.naturalKey);

    const idA = deriveNodeId('package', pkgNodeA?.naturalKey ?? '');
    const idB = deriveNodeId('package', pkgNodeB?.naturalKey ?? '');
    expect(idA).not.toBe(idB);
  });

  it('never emits an implicit package when the repo declares a pnpm workspace', async () => {
    const repoRoot = await makeTempRepo({
      'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      'packages/core/package.json': JSON.stringify({ name: 'core' }),
    });
    const ctx = ctxFor(repoRoot, 'revealui');

    const [wsProduct] = await workspaceExtractor.extract(ctx);
    const packageNodes = wsProduct?.nodes.filter((n) => n.kind === 'package') ?? [];
    expect(packageNodes).toHaveLength(1);
    expect(packageNodes[0]?.naturalKey).toBe(packageKey('revealui', 'core'));
    // The implicit-package fallback name (`revealui`, the repo dir basename)
    // must never appear alongside the real workspace-derived package.
    expect(packageNodes.some((n) => n.naturalKey === packageKey('revealui', 'revealui'))).toBe(
      false,
    );
  });
});
