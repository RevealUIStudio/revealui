import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type GenerateResult, generate } from '../generate.js';
import { listComponentNames } from '../render.js';
import { kebabCase } from '../util.js';

let outDir: string;
let result: GenerateResult;

beforeAll(async () => {
  outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'preview-gen-test-'));
  result = await generate({ outDir, compileCssStep: true });
}, 60_000);

afterAll(async () => {
  await fs.rm(outDir, { recursive: true, force: true });
});

function isDsCardMarker(line: string, expectedName?: string): boolean {
  const ok =
    line.startsWith('<!-- @dsCard group="Components (from code)"') &&
    line.includes(' name="') &&
    line.trimEnd().endsWith('-->');
  if (!expectedName) return ok;
  return ok && line.includes(`name="${expectedName}"`);
}

async function firstLine(rel: string): Promise<string> {
  const content = await fs.readFile(path.join(outDir, rel), 'utf8');
  return content.split('\n', 1)[0] ?? '';
}

describe('design-system preview generator', () => {
  it('emits a file for every public component export', async () => {
    const names = listComponentNames();
    expect(names.length).toBeGreaterThan(100);
    for (const name of names) {
      const rel = path.join('generated/components', `${kebabCase(name)}.html`);
      const stat = await fs.stat(path.join(outDir, rel)).catch(() => null);
      expect(stat, `missing preview for ${name}`).not.toBeNull();
    }
    expect(result.components.length).toBe(names.length);
  });

  it('starts every component HTML with a valid @dsCard marker', async () => {
    for (const component of result.components) {
      const line = await firstLine(path.join('generated/components', component.fileName));
      expect(isDsCardMarker(line, component.name), `${component.name}: ${line}`).toBe(true);
    }
  });

  it('marks the catalog index with a @dsCard Component Catalog marker', async () => {
    const line = await firstLine('generated/index.html');
    expect(isDsCardMarker(line, 'Component Catalog')).toBe(true);
  });

  it('compiles a non-empty _preview.css with tokens and used classes', async () => {
    const css = await fs.readFile(path.join(outDir, 'generated/_preview.css'), 'utf8');
    expect(css.length).toBeGreaterThan(1000);
    expect(css).toContain('--rvui-');
    // A class the Button preview actually renders must be present in the CSS.
    const buttonHtml = await fs.readFile(
      path.join(outDir, 'generated/components/button.html'),
      'utf8',
    );
    expect(buttonHtml).toContain('inline-flex');
    expect(css).toContain('.inline-flex');
    expect(css).toContain('bg-primary');
  });

  it('renders expected variant/example sections for key components', async () => {
    const cases: Array<{ file: string; needles: string[] }> = [
      { file: 'button.html', needles: ['Variants', 'Button Group', '<button'] },
      { file: 'card.html', needles: ['Card Grid', 'dsc-canvas'] },
      { file: 'dialog.html', needles: ['Open state', 'Delete project'] },
      { file: 'table.html', needles: ['dsc-canvas', '<table'] },
    ];
    for (const { file, needles } of cases) {
      const html = await fs.readFile(path.join(outDir, 'generated/components', file), 'utf8');
      expect(html.length, `${file} empty`).toBeGreaterThan(200);
      for (const needle of needles) {
        expect(html.includes(needle), `${file} missing ${needle}`).toBe(true);
      }
    }
  });

  it('writes a manifest whose hashes verify against the emitted files', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8')) as {
      sourceCommit: string;
      generatedAt: string;
      files: Record<string, string>;
    };
    expect(manifest.sourceCommit.length).toBeGreaterThan(0);
    expect(Date.parse(manifest.generatedAt)).not.toBeNaN();
    const entries = Object.entries(manifest.files);
    expect(entries.length).toBe(result.emittedFiles.length);
    for (const [rel, hash] of entries) {
      const buf = await fs.readFile(path.join(outDir, rel));
      const actual = createHash('sha256').update(buf).digest('hex');
      expect(actual, `hash mismatch for ${rel}`).toBe(hash);
    }
  });
});
