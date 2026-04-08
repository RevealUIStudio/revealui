import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileGrepTool } from '../../../tools/coding/file-grep.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-file-grep');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });

  mkdirSync(join(ROOT, 'src'), { recursive: true });
  mkdirSync(join(ROOT, 'lib'), { recursive: true });

  writeFileSync(
    join(ROOT, 'src', 'math.ts'),
    'export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport function multiply(a: number, b: number): number {\n  return a * b;\n}\n',
  );
  writeFileSync(
    join(ROOT, 'src', 'greet.ts'),
    // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional fixture content
    'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n',
  );
  writeFileSync(join(ROOT, 'lib', 'config.json'), '{"port": 3000, "host": "localhost"}\n');
  writeFileSync(join(ROOT, 'README.md'), '# Project\n\nThis is a test project.\n');
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('file_grep tool', () => {
  it('has correct metadata', () => {
    expect(fileGrepTool.name).toBe('file_grep');
  });

  it('finds matches across files', async () => {
    const result = await fileGrepTool.execute({ pattern: 'export function' });
    expect(result.success).toBe(true);
    const data = result.data as { matchCount: number; filesWithMatches: number };
    expect(data.matchCount).toBe(3); // add, multiply, greet
    expect(data.filesWithMatches).toBe(2); // math.ts, greet.ts
  });

  it('searches with regex', async () => {
    const result = await fileGrepTool.execute({ pattern: 'function \\w+\\(' });
    expect(result.success).toBe(true);
    const data = result.data as { matchCount: number };
    expect(data.matchCount).toBeGreaterThanOrEqual(3);
  });

  it('filters by glob', async () => {
    const result = await fileGrepTool.execute({ pattern: 'export', glob: '**/*.ts' });
    expect(result.success).toBe(true);
    const data = result.data as { filesSearched: number };
    // Should only search .ts files
    expect(data.filesSearched).toBeGreaterThanOrEqual(2);
    expect(result.content).not.toContain('README.md');
  });

  it('searches in subdirectory via path', async () => {
    const result = await fileGrepTool.execute({ pattern: 'number', path: 'src' });
    expect(result.success).toBe(true);
    const data = result.data as { matchCount: number };
    expect(data.matchCount).toBeGreaterThanOrEqual(2); // params in math.ts
  });

  it('returns context lines', async () => {
    const result = await fileGrepTool.execute({
      pattern: 'return a \\+ b',
      contextLines: 1,
    });
    expect(result.success).toBe(true);
    // Should include surrounding lines
    expect(result.content).toContain('function add');
  });

  it('returns empty results for no matches', async () => {
    const result = await fileGrepTool.execute({ pattern: 'zzz_no_match_zzz' });
    expect(result.success).toBe(true);
    const data = result.data as { matchCount: number };
    expect(data.matchCount).toBe(0);
  });

  it('returns error for invalid regex', async () => {
    const result = await fileGrepTool.execute({ pattern: '[invalid(' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid regex');
  });

  it('skips binary files', async () => {
    writeFileSync(join(ROOT, 'image.png'), Buffer.from([137, 80, 78, 71]));
    const result = await fileGrepTool.execute({ pattern: 'PNG' });
    expect(result.success).toBe(true);
    // PNG file should not be searched
    expect(result.content).not.toContain('image.png');
  });

  it('includes file:line format in results', async () => {
    const result = await fileGrepTool.execute({ pattern: 'greet' });
    expect(result.success).toBe(true);
    expect(result.content).toMatch(/src\/greet\.ts:\d+/);
  });
});
