import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCodingTools } from '../../../tools/coding/index.js';
import { getSafetyConfig } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-coding-index');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('createCodingTools', () => {
  it('returns all 10 tools by default', () => {
    const tools = createCodingTools({ projectRoot: ROOT });
    expect(tools).toHaveLength(10);
    const names = tools.map((t) => t.name);
    expect(names).toContain('file_read');
    expect(names).toContain('file_write');
    expect(names).toContain('file_edit');
    expect(names).toContain('file_glob');
    expect(names).toContain('file_grep');
    expect(names).toContain('shell_exec');
    expect(names).toContain('git_ops');
    expect(names).toContain('project_context');
    expect(names).toContain('test_runner');
    expect(names).toContain('lint_fix');
  });

  it('configures safety with provided project root', () => {
    createCodingTools({ projectRoot: ROOT });
    const config = getSafetyConfig();
    expect(config.projectRoot).toBe(ROOT);
  });

  it('filters tools via include list', () => {
    const tools = createCodingTools({
      projectRoot: ROOT,
      include: ['file_read', 'file_write'],
    });
    expect(tools).toHaveLength(2);
    expect(tools[0]?.name).toBe('file_read');
    expect(tools[1]?.name).toBe('file_write');
  });

  it('passes safety config through', () => {
    createCodingTools({
      projectRoot: ROOT,
      allowedPaths: ['/tmp/extra'],
      extraDeniedCommands: ['docker rm'],
    });
    const config = getSafetyConfig();
    expect(config.allowedPaths).toEqual(['/tmp/extra']);
    expect(config.extraDeniedCommands).toEqual(['docker rm']);
  });

  it('returns a fresh array each call', () => {
    const a = createCodingTools({ projectRoot: ROOT });
    const b = createCodingTools({ projectRoot: ROOT });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('each tool has required properties', () => {
    const tools = createCodingTools({ projectRoot: ROOT });
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(typeof tool.execute).toBe('function');
    }
  });
});
