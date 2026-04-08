import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileWriteTool } from '../../../tools/coding/file-write.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-file-write');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('file_write tool', () => {
  it('has correct metadata', () => {
    expect(fileWriteTool.name).toBe('file_write');
  });

  it('writes a new file', async () => {
    const result = await fileWriteTool.execute({
      path: 'output.txt',
      content: 'hello world',
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Wrote');
    expect(readFileSync(join(ROOT, 'output.txt'), 'utf8')).toBe('hello world\n');
  });

  it('normalizes trailing newline', async () => {
    await fileWriteTool.execute({ path: 'no-newline.txt', content: 'no newline' });
    expect(readFileSync(join(ROOT, 'no-newline.txt'), 'utf8')).toBe('no newline\n');
  });

  it('does not double trailing newline', async () => {
    await fileWriteTool.execute({ path: 'has-newline.txt', content: 'has newline\n' });
    expect(readFileSync(join(ROOT, 'has-newline.txt'), 'utf8')).toBe('has newline\n');
  });

  it('creates parent directories by default', async () => {
    const result = await fileWriteTool.execute({
      path: 'deep/nested/dir/file.txt',
      content: 'nested',
    });
    expect(result.success).toBe(true);
    expect(existsSync(join(ROOT, 'deep/nested/dir/file.txt'))).toBe(true);
  });

  it('fails without parent dirs when createDirs is false', async () => {
    const result = await fileWriteTool.execute({
      path: 'nonexistent-dir/file.txt',
      content: 'fail',
      createDirs: false,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to write');
  });

  it('overwrites existing files', async () => {
    await fileWriteTool.execute({ path: 'overwrite.txt', content: 'first' });
    await fileWriteTool.execute({ path: 'overwrite.txt', content: 'second' });
    expect(readFileSync(join(ROOT, 'overwrite.txt'), 'utf8')).toBe('second\n');
  });

  it('reports byte count and line count', async () => {
    const result = await fileWriteTool.execute({
      path: 'stats.txt',
      content: 'line 1\nline 2\nline 3',
    });
    expect(result.success).toBe(true);
    const data = result.data as { bytes: number; lines: number };
    expect(data.lines).toBe(3);
    expect(data.bytes).toBeGreaterThan(0);
  });

  it('blocks path escapes', async () => {
    const result = await fileWriteTool.execute({
      path: '../../etc/evil',
      content: 'bad',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('escapes project root');
  });

  it('blocks .env writes', async () => {
    const result = await fileWriteTool.execute({
      path: '.env.local',
      content: 'SECRET=bad',
    });
    expect(result.success).toBe(false);
  });
});
