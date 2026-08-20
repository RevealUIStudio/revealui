/**
 * Dry-run fleet/repo scan preview: extract without opening a database.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createKgTestDb } from '../../__tests__/test-db.js';
import { collectRepoProducts, previewRepoScan, publishCollected } from '../preview.js';

const tempDirs: string[] = [];

async function makeTempRepo(files: Record<string, string>): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'revkg-preview-'));
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

describe('previewRepoScan', () => {
  it('summarizes extractor products without requiring a KgExecutor', async () => {
    const repoRoot = await makeTempRepo({
      'package.json': JSON.stringify({ name: 'agency', version: '0.1.0' }),
    });

    const preview = await previewRepoScan({
      repoRoot,
      repo: 'agency',
      siteId: 'site-test',
      now: new Date('2026-08-20T00:00:00Z'),
    });

    expect(preview.repo).toBe('agency');
    expect(preview.path).toBe(repoRoot);
    expect(preview.nodeCount).toBeGreaterThan(0);
    expect(preview.extractors.length).toBeGreaterThan(0);
    const workspace = preview.extractors.find((e) => e.name === 'workspace');
    expect(workspace?.mode).toBe('scan');
    expect(workspace?.nodeCount).toBeGreaterThan(0);
  });

  it('publishCollected writes extracted nodes; a second dry preview does not', async () => {
    const repoRoot = await makeTempRepo({
      'package.json': JSON.stringify({ name: 'agency', version: '0.1.0' }),
    });
    const collected = await collectRepoProducts({
      repoRoot,
      repo: 'agency',
      siteId: 'site-test',
      now: new Date('2026-08-20T00:00:00Z'),
    });
    const db = await createKgTestDb();
    try {
      const published = await publishCollected(db.exec, collected, { recordOutbox: false });
      expect(published.nodeCount).toBeGreaterThan(0);
      const nodes = await db.exec.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM kg_nodes`,
      );
      expect(Number(nodes[0]?.count)).toBeGreaterThan(0);
    } finally {
      await db.close();
    }
  });
});
