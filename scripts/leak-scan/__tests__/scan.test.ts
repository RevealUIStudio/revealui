import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeIsIgnored, parseLeakignore } from '../leakignore';
import { BASE_RULES } from '../rules';
import {
  DEFAULT_EXCLUDE_DIRS,
  DEFAULT_EXCLUDE_FILE_GLOBS,
  scanContent,
  scanPaths,
  walkFiles,
} from '../scan';

describe('scanContent', () => {
  it('reports tag, 1-based line number, file, and content for a hit', () => {
    const content = 'clean line\nteam_ABCDEFGHIJKLMNOP12 here\nclean';
    const findings = scanContent(BASE_RULES, content, 'x.ts');
    const hit = findings.find((f) => f.tag === 'vercel-org-id');
    expect(hit?.line).toBe(2);
    expect(hit?.file).toBe('x.ts');
  });
  it('returns nothing for clean content', () => {
    expect(scanContent(BASE_RULES, 'totally clean\nlines here', 'x.ts')).toEqual([]);
  });
});

describe('walkFiles + scanPaths (filesystem)', () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'leakscan-'));
    writeFileSync(join(root, 'a.ts'), "const home = '/home/alice/project';\n");
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'pkg', 'b.ts'), 'team_ABCDEFGHIJKLMNOP12\n');
    writeFileSync(join(root, 'logo.png'), 'team_ABCDEFGHIJKLMNOP12\n');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'ok.ts'), 'nothing to see\n');
  });
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('excludes node_modules and image files, keeps real source', () => {
    const files = walkFiles(root, DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_FILE_GLOBS);
    expect(files.some((f) => f.includes('node_modules'))).toBe(false);
    expect(files.some((f) => f.endsWith('.png'))).toBe(false);
    expect(files.some((f) => f.endsWith('a.ts'))).toBe(true);
  });

  it('finds the home-path leak in a.ts and nothing under node_modules', () => {
    const { findings, violations } = scanPaths(BASE_RULES, [root]);
    expect(violations).toBeGreaterThan(0);
    expect(findings.every((f) => !f.file.includes('node_modules'))).toBe(true);
    expect(findings.some((f) => f.tag === 'abs-home-path')).toBe(true);
  });

  it('suppresses a finding via .leakignore (path-glob + tag)', () => {
    const isIgnored = makeIsIgnored(parseLeakignore('a.ts  abs-home-path\n'));
    const { findings } = scanPaths(BASE_RULES, [root], { isIgnored });
    expect(findings.some((f) => f.tag === 'abs-home-path')).toBe(false);
  });

  it('skips symlinks (no recursion into linked dirs)', () => {
    let linked = false;
    try {
      symlinkSync(join(root, 'src'), join(root, 'linkdir'), 'dir');
      linked = true;
    } catch {
      // some sandboxes block symlink creation; fall through
    }
    const files = walkFiles(root, DEFAULT_EXCLUDE_DIRS, DEFAULT_EXCLUDE_FILE_GLOBS);
    if (linked) {
      expect(files.some((f) => f.includes('linkdir'))).toBe(false);
    } else {
      expect(files.length).toBeGreaterThan(0);
    }
  });
});
