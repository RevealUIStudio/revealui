import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fileEditTool } from '../../../tools/coding/file-edit.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-file-edit');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });
});

beforeEach(() => {
  writeFileSync(
    join(ROOT, 'target.ts'),
    'const name = "old";\nconst value = 42;\nexport { name, value };\n',
  );
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('file_edit tool', () => {
  it('has correct metadata', () => {
    expect(fileEditTool.name).toBe('file_edit');
  });

  it('replaces a unique string', async () => {
    const result = await fileEditTool.execute({
      path: 'target.ts',
      old_text: 'const name = "old"',
      new_text: 'const name = "new"',
    });
    expect(result.success).toBe(true);
    expect(result.content).toContain('Edited');
    const content = readFileSync(join(ROOT, 'target.ts'), 'utf8');
    expect(content).toContain('"new"');
    expect(content).not.toContain('"old"');
  });

  it('preserves surrounding content', async () => {
    await fileEditTool.execute({
      path: 'target.ts',
      old_text: 'const value = 42',
      new_text: 'const value = 99',
    });
    const content = readFileSync(join(ROOT, 'target.ts'), 'utf8');
    expect(content).toContain('const name = "old"');
    expect(content).toContain('const value = 99');
    expect(content).toContain('export { name, value }');
  });

  it('fails when old_text not found', async () => {
    const result = await fileEditTool.execute({
      path: 'target.ts',
      old_text: 'does not exist',
      new_text: 'replacement',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when old_text appears multiple times', async () => {
    writeFileSync(join(ROOT, 'dup.ts'), 'foo\nfoo\nbar\n');
    const result = await fileEditTool.execute({
      path: 'dup.ts',
      old_text: 'foo',
      new_text: 'baz',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('2 times');
  });

  it('fails when old_text equals new_text', async () => {
    const result = await fileEditTool.execute({
      path: 'target.ts',
      old_text: 'const value = 42',
      new_text: 'const value = 42',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('identical');
  });

  it('returns error for nonexistent file', async () => {
    const result = await fileEditTool.execute({
      path: 'missing.ts',
      old_text: 'x',
      new_text: 'y',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('reports line count changes', async () => {
    const result = await fileEditTool.execute({
      path: 'target.ts',
      old_text: 'const value = 42;',
      new_text: 'const value = 42;\nconst extra = true;',
    });
    expect(result.success).toBe(true);
    const data = result.data as { addedLines: number };
    expect(data.addedLines).toBe(1);
  });

  it('reports negative line changes on deletion', async () => {
    const result = await fileEditTool.execute({
      path: 'target.ts',
      old_text: 'const name = "old";\nconst value = 42;',
      new_text: 'const combined = { name: "old", value: 42 };',
    });
    expect(result.success).toBe(true);
    const data = result.data as { addedLines: number };
    expect(data.addedLines).toBe(-1);
  });

  it('blocks path escapes', async () => {
    const result = await fileEditTool.execute({
      path: '../../etc/passwd',
      old_text: 'root',
      new_text: 'hacked',
    });
    expect(result.success).toBe(false);
  });
});
