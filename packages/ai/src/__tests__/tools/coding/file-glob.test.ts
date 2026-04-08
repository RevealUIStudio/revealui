import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileGlobTool } from '../../../tools/coding/file-glob.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-file-glob');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });

  // Create fixture tree
  mkdirSync(join(ROOT, 'src', 'components'), { recursive: true });
  mkdirSync(join(ROOT, 'src', '__tests__'), { recursive: true });
  mkdirSync(join(ROOT, 'lib'), { recursive: true });

  writeFileSync(join(ROOT, 'src', 'index.ts'), 'export {};');
  writeFileSync(join(ROOT, 'src', 'utils.ts'), 'export {};');
  writeFileSync(join(ROOT, 'src', 'components', 'Button.tsx'), '<button/>');
  writeFileSync(join(ROOT, 'src', 'components', 'Card.tsx'), '<div/>');
  writeFileSync(join(ROOT, 'src', '__tests__', 'index.test.ts'), 'test');
  writeFileSync(join(ROOT, 'lib', 'helper.js'), 'module.exports = {}');
  writeFileSync(join(ROOT, 'package.json'), '{}');
  writeFileSync(join(ROOT, 'README.md'), '# test');
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('file_glob tool', () => {
  it('has correct metadata', () => {
    expect(fileGlobTool.name).toBe('file_glob');
  });

  it('finds all TypeScript files with **/*.ts', async () => {
    const result = await fileGlobTool.execute({ pattern: '**/*.ts' });
    expect(result.success).toBe(true);
    const data = result.data as { files: string[] };
    const files = data.files;
    expect(files).toContain('src/index.ts');
    expect(files).toContain('src/utils.ts');
    expect(files).toContain('src/__tests__/index.test.ts');
    // Should not include .tsx
    expect(files).not.toContain('src/components/Button.tsx');
  });

  it('finds TSX files with **/*.tsx', async () => {
    const result = await fileGlobTool.execute({ pattern: '**/*.tsx' });
    expect(result.success).toBe(true);
    const data = result.data as { files: string[] };
    expect(data.files).toContain('src/components/Button.tsx');
    expect(data.files).toContain('src/components/Card.tsx');
  });

  it('supports single wildcard *', async () => {
    const result = await fileGlobTool.execute({ pattern: '*.md' });
    expect(result.success).toBe(true);
    const data = result.data as { files: string[] };
    expect(data.files).toContain('README.md');
  });

  it('supports path-scoped patterns', async () => {
    const result = await fileGlobTool.execute({ pattern: 'src/components/*.tsx' });
    expect(result.success).toBe(true);
    const data = result.data as { files: string[] };
    expect(data.files.length).toBe(2);
  });

  it('supports subdirectory search via path param', async () => {
    // walkDir returns paths relative to project root, so use a glob that matches
    const result = await fileGlobTool.execute({ pattern: 'src/*.ts', path: 'src' });
    expect(result.success).toBe(true);
    const data = result.data as { files: string[] };
    expect(data.files.some((f: string) => f.includes('index.ts'))).toBe(true);
  });

  it('returns empty for no matches', async () => {
    const result = await fileGlobTool.execute({ pattern: '**/*.py' });
    expect(result.success).toBe(true);
    const data = result.data as { totalMatches: number };
    expect(data.totalMatches).toBe(0);
  });

  it('returns error for nonexistent directory', async () => {
    const result = await fileGlobTool.execute({ pattern: '*.ts', path: 'nope' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('skips node_modules', async () => {
    mkdirSync(join(ROOT, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(ROOT, 'node_modules', 'pkg', 'index.ts'), '');
    const result = await fileGlobTool.execute({ pattern: '**/*.ts' });
    const data = result.data as { files: string[] };
    expect(data.files.every((f: string) => !f.includes('node_modules'))).toBe(true);
  });

  it('reports total match count', async () => {
    const result = await fileGlobTool.execute({ pattern: '**/*.*' });
    expect(result.success).toBe(true);
    const data = result.data as { totalMatches: number };
    expect(data.totalMatches).toBeGreaterThanOrEqual(6);
  });
});
