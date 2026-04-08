import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileReadTool } from '../../../tools/coding/file-read.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-file-read');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });

  // Create test fixtures
  writeFileSync(join(ROOT, 'hello.txt'), 'line 1\nline 2\nline 3\nline 4\nline 5\n');
  writeFileSync(join(ROOT, 'empty.txt'), '');
  mkdirSync(join(ROOT, 'subdir'), { recursive: true });
  writeFileSync(join(ROOT, 'subdir', 'nested.ts'), 'export const x = 1;\nexport const y = 2;\n');
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('file_read tool', () => {
  it('has correct metadata', () => {
    expect(fileReadTool.name).toBe('file_read');
    expect(fileReadTool.description).toBeDefined();
  });

  it('reads a file with line numbers', async () => {
    const result = await fileReadTool.execute({ path: 'hello.txt' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('hello.txt');
    expect(result.content).toContain('line 1');
    expect(result.content).toContain('line 5');
    expect(result.data).toMatchObject({
      path: 'hello.txt',
      totalLines: 6, // 5 lines + trailing newline = 6 elements after split
    });
  });

  it('reads nested files', async () => {
    const result = await fileReadTool.execute({ path: 'subdir/nested.ts' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('export const x');
  });

  it('supports offset parameter', async () => {
    const result = await fileReadTool.execute({ path: 'hello.txt', offset: 3 });
    expect(result.success).toBe(true);
    expect(result.content).toContain('line 3');
    // Should not contain lines before offset
    const data = result.data as { startLine: number };
    expect(data.startLine).toBe(3);
  });

  it('supports limit parameter', async () => {
    const result = await fileReadTool.execute({ path: 'hello.txt', limit: 2 });
    expect(result.success).toBe(true);
    const data = result.data as { linesReturned: number };
    expect(data.linesReturned).toBe(2);
  });

  it('supports offset + limit together', async () => {
    const result = await fileReadTool.execute({ path: 'hello.txt', offset: 2, limit: 2 });
    expect(result.success).toBe(true);
    const data = result.data as { startLine: number; linesReturned: number };
    expect(data.startLine).toBe(2);
    expect(data.linesReturned).toBe(2);
  });

  it('returns error for nonexistent file', async () => {
    const result = await fileReadTool.execute({ path: 'nope.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for directory', async () => {
    const result = await fileReadTool.execute({ path: 'subdir' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('directory');
  });

  it('blocks path escapes', async () => {
    const result = await fileReadTool.execute({ path: '../../etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('escapes project root');
  });

  it('blocks .env files', async () => {
    const result = await fileReadTool.execute({ path: '.env' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('denied pattern');
  });

  it('handles empty files', async () => {
    const result = await fileReadTool.execute({ path: 'empty.txt' });
    expect(result.success).toBe(true);
  });

  it('includes truncation info when content is limited', async () => {
    const result = await fileReadTool.execute({ path: 'hello.txt', limit: 2 });
    expect(result.success).toBe(true);
    expect(result.content).toContain('lines 1-2 of');
  });
});
