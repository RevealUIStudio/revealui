import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as React from 'react';
import { compileCss } from './css.js';
import { defaultOutDir, repoRoot } from './paths.js';
import { buildCuratedRegistry } from './registry.js';
import {
  type ComponentRenderResult,
  listComponentNames,
  renderCatalogPage,
  renderComponentPage,
} from './render.js';
import { seededRandom, sha256 } from './util.js';

export interface GenerateOptions {
  /** Output bundle root. Defaults to <repoRoot>/preview-dist. */
  outDir?: string;
  /** Compile _preview.css (the slow step). Defaults to true. */
  compileCssStep?: boolean;
}

export interface GenerateStats {
  total: number;
  curated: number;
  default: number;
  stub: number;
}

export interface GenerateResult {
  outDir: string;
  sourceCommit: string;
  generatedAt: string;
  components: ComponentRenderResult[];
  stats: GenerateStats;
  emittedFiles: string[];
  cssBytes: number;
}

function sourceCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).toString().trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Render every public @revealui/presentation component to a static @dsCard
 * preview page, compile the shared Tailwind CSS, and write a hash manifest.
 * Deterministic given the same source commit: stable ordering, seeded
 * Math.random, timestamps confined to manifest.json.
 */
export async function generate(options: GenerateOptions = {}): Promise<GenerateResult> {
  const outDir = options.outDir ?? defaultOutDir;
  const compileCssStep = options.compileCssStep ?? true;

  // Showcase story modules use the classic JSX runtime and expect a global React.
  (globalThis as Record<string, unknown>).React = React;

  const generatedDir = path.join(outDir, 'generated');
  const componentsDir = path.join(generatedDir, 'components');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(componentsDir, { recursive: true });

  const curated = await buildCuratedRegistry();
  const names = listComponentNames();

  // Determinism: freeze Math.random for the render pass only.
  const realRandom = Math.random;
  Math.random = seededRandom(0x5eed);
  let results: ComponentRenderResult[];
  try {
    results = names.map((name) => renderComponentPage(name, curated.get(name)));
  } finally {
    Math.random = realRandom;
  }

  for (const result of results) {
    await fs.writeFile(path.join(componentsDir, result.fileName), result.html);
  }

  const catalogHtml = renderCatalogPage(results);
  await fs.writeFile(path.join(generatedDir, 'index.html'), catalogHtml);

  const cssPath = path.join(generatedDir, '_preview.css');
  if (compileCssStep) {
    await compileCss(componentsDir, cssPath);
  } else {
    await fs.writeFile(cssPath, '/* css compile skipped */\n');
  }

  const stats: GenerateStats = {
    total: results.length,
    curated: results.filter((r) => r.status === 'curated').length,
    default: results.filter((r) => r.status === 'default').length,
    stub: results.filter((r) => r.status === 'stub').length,
  };

  const emittedRel = [
    ...results.map((r) => path.posix.join('generated/components', r.fileName)),
    'generated/index.html',
    'generated/_preview.css',
  ].sort();

  const filesManifest: Record<string, string> = {};
  for (const rel of emittedRel) {
    const buf = await fs.readFile(path.join(outDir, rel));
    filesManifest[rel] = sha256(buf);
  }

  const generatedAt = new Date().toISOString();
  const manifest = {
    sourceCommit: sourceCommit(),
    generatedAt,
    files: filesManifest,
  };
  await fs.writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const cssBytes = (await fs.stat(cssPath)).size;

  return {
    outDir,
    sourceCommit: manifest.sourceCommit,
    generatedAt,
    components: results,
    stats,
    emittedFiles: emittedRel,
    cssBytes,
  };
}
