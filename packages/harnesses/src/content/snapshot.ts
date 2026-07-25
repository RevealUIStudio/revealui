/**
 * Definition ↔ generated-content snapshot (GAP-406 residual).
 *
 * Package definitions under `content/definitions/` are the authoring SSOT.
 * Generators produce tool-specific trees (manager `.revealui/content/`, etc.).
 * Committed hashes under `content-snapshots/` lock that emit surface so CI
 * fails when definitions change without refreshing the snapshot.
 *
 * Disk drift (local materialize vs definitions) remains `diffContent` /
 * `content diff --check`. This module is the **committed** golden lock.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './definitions/index.js';
import { getGenerator, listGenerators } from './generators/index.js';
import type { Manifest } from './schemas/manifest.js';

function generateForSnapshot(
  generatorId: string,
  manifest: Manifest,
  projectRoot: string,
): { relativePath: string; content: string }[] {
  const generator = getGenerator(generatorId);
  if (!generator) {
    throw new Error(
      `Unknown generator "${generatorId}". Available: ${listGenerators().join(', ')}`,
    );
  }
  return generator.generateAll(manifest, { projectRoot });
}

export const CONTENT_SNAPSHOT_VERSION = 1 as const;

export interface ContentSnapshotFile {
  relativePath: string;
  sha256: string;
}

export interface ContentSnapshot {
  version: typeof CONTENT_SNAPSHOT_VERSION;
  generatorId: string;
  /** Sorted by relativePath (stable for git diffs). */
  files: ContentSnapshotFile[];
}

export interface SnapshotDrift {
  relativePath: string;
  kind: 'missing-in-snapshot' | 'missing-in-generate' | 'hash-mismatch';
  expectedSha256?: string;
  actualSha256?: string;
}

export interface SnapshotCheckResult {
  ok: boolean;
  generatorId: string;
  drifts: SnapshotDrift[];
  fileCount: number;
}

/** Directory holding committed `*.json` snapshots (package root). */
export function getContentSnapshotsDir(): string {
  // src/content/snapshot.ts → packageRoot/content-snapshots
  // dist/content/snapshot.js → packageRoot/content-snapshots
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '..', '..', 'content-snapshots');
}

export function snapshotPathFor(generatorId: string, snapshotsDir?: string): string {
  const dir = snapshotsDir ?? getContentSnapshotsDir();
  return join(dir, `${generatorId}.json`);
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Build a snapshot from live definitions + generator (does not read disk).
 * Uses a fixed synthetic projectRoot so path-sensitive generators stay stable.
 */
export function buildContentSnapshot(
  generatorId: string,
  options?: { manifest?: Manifest; projectRoot?: string },
): ContentSnapshot {
  const manifest = options?.manifest ?? buildManifest();
  const projectRoot = options?.projectRoot ?? '/revealui-content-snapshot';
  const files = generateForSnapshot(generatorId, manifest, projectRoot);
  const entries: ContentSnapshotFile[] = files
    .map((f) => ({
      relativePath: f.relativePath,
      sha256: hashContent(f.content),
    }))
    .sort((a, b) =>
      a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
    );

  return {
    version: CONTENT_SNAPSHOT_VERSION,
    generatorId,
    files: entries,
  };
}

export function loadContentSnapshot(filePath: string): ContentSnapshot {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid content snapshot (not an object): ${filePath}`);
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== CONTENT_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported content snapshot version ${String(obj.version)} in ${filePath} (want ${CONTENT_SNAPSHOT_VERSION})`,
    );
  }
  if (typeof obj.generatorId !== 'string' || obj.generatorId.length === 0) {
    throw new Error(`Content snapshot missing generatorId: ${filePath}`);
  }
  if (!Array.isArray(obj.files)) {
    throw new Error(`Content snapshot missing files[]: ${filePath}`);
  }
  const files: ContentSnapshotFile[] = [];
  for (const item of obj.files) {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid snapshot file entry in ${filePath}`);
    }
    const f = item as Record<string, unknown>;
    if (typeof f.relativePath !== 'string' || typeof f.sha256 !== 'string') {
      throw new Error(`Snapshot file entry needs relativePath + sha256 in ${filePath}`);
    }
    if (f.sha256.length !== 64) {
      throw new Error(`Snapshot sha256 must be 64 hex chars (${f.relativePath})`);
    }
    files.push({ relativePath: f.relativePath, sha256: f.sha256 });
  }
  return {
    version: CONTENT_SNAPSHOT_VERSION,
    generatorId: obj.generatorId,
    files,
  };
}

export function writeContentSnapshot(filePath: string, snapshot: ContentSnapshot): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(filePath, body, 'utf8');
}

/** Compare an expected snapshot to freshly generated output. */
export function checkContentSnapshot(
  expected: ContentSnapshot,
  options?: { manifest?: Manifest; projectRoot?: string },
): SnapshotCheckResult {
  const actual = buildContentSnapshot(expected.generatorId, options);
  const expectedMap = new Map(expected.files.map((f) => [f.relativePath, f.sha256]));
  const actualMap = new Map(actual.files.map((f) => [f.relativePath, f.sha256]));
  const drifts: SnapshotDrift[] = [];

  for (const [path, sha] of actualMap) {
    const exp = expectedMap.get(path);
    if (exp === undefined) {
      drifts.push({
        relativePath: path,
        kind: 'missing-in-snapshot',
        actualSha256: sha,
      });
    } else if (exp !== sha) {
      drifts.push({
        relativePath: path,
        kind: 'hash-mismatch',
        expectedSha256: exp,
        actualSha256: sha,
      });
    }
  }
  for (const [path, sha] of expectedMap) {
    if (!actualMap.has(path)) {
      drifts.push({
        relativePath: path,
        kind: 'missing-in-generate',
        expectedSha256: sha,
      });
    }
  }

  drifts.sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  );

  return {
    ok: drifts.length === 0,
    generatorId: expected.generatorId,
    drifts,
    fileCount: actual.files.length,
  };
}

/**
 * Check all generators that have a committed snapshot file.
 * Generators without a snapshot file are reported as errors (fail closed).
 */
export function checkAllContentSnapshots(options?: {
  snapshotsDir?: string;
  manifest?: Manifest;
  projectRoot?: string;
}): { ok: boolean; results: SnapshotCheckResult[]; errors: string[] } {
  const dir = options?.snapshotsDir ?? getContentSnapshotsDir();
  const results: SnapshotCheckResult[] = [];
  const errors: string[] = [];
  const generators = listGenerators().sort();

  for (const id of generators) {
    const path = snapshotPathFor(id, dir);
    try {
      const expected = loadContentSnapshot(path);
      if (expected.generatorId !== id) {
        errors.push(
          `Snapshot ${path} has generatorId=${expected.generatorId}, expected file stem ${id}`,
        );
        continue;
      }
      results.push(checkContentSnapshot(expected, options));
    } catch (err) {
      errors.push(
        `Missing or invalid snapshot for generator "${id}" at ${path}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const ok = errors.length === 0 && results.every((r) => r.ok);
  return { ok, results, errors };
}

/** Write snapshots for one or all registered generators. */
export function writeAllContentSnapshots(options?: {
  snapshotsDir?: string;
  generatorIds?: string[];
  manifest?: Manifest;
  projectRoot?: string;
}): string[] {
  const dir = options?.snapshotsDir ?? getContentSnapshotsDir();
  const ids = options?.generatorIds ?? listGenerators().sort();
  const written: string[] = [];
  for (const id of ids) {
    const snap = buildContentSnapshot(id, options);
    const path = snapshotPathFor(id, dir);
    writeContentSnapshot(path, snap);
    written.push(path);
  }
  return written;
}
