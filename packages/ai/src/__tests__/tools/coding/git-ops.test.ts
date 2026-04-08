import { execSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gitOpsTool } from '../../../tools/coding/git-ops.js';
import { configureSafety } from '../../../tools/coding/safety.js';

const ROOT = join(process.cwd(), 'tmp-test-git-ops');

beforeAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });

  // Initialize a git repo with a commit
  execSync('git init', { cwd: ROOT });
  execSync('git config user.email "test@test.com"', { cwd: ROOT });
  execSync('git config user.name "Test"', { cwd: ROOT });
  writeFileSync(join(ROOT, 'file.txt'), 'initial content\n');
  execSync('git add .', { cwd: ROOT });
  execSync('git commit -m "initial commit"', { cwd: ROOT });

  configureSafety({ projectRoot: ROOT });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('git_ops tool', () => {
  it('has correct metadata', () => {
    expect(gitOpsTool.name).toBe('git_ops');
  });

  it('runs git status', async () => {
    const result = await gitOpsTool.execute({ operation: 'status' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('git status');
  });

  it('runs git log', async () => {
    const result = await gitOpsTool.execute({ operation: 'log' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('initial commit');
  });

  it('runs git log with args', async () => {
    const result = await gitOpsTool.execute({ operation: 'log', args: ['-n', '1', '--oneline'] });
    expect(result.success).toBe(true);
    expect(result.content).toContain('initial commit');
  });

  it('runs git diff', async () => {
    writeFileSync(join(ROOT, 'file.txt'), 'modified content\n');
    const result = await gitOpsTool.execute({ operation: 'diff' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('git diff');
    // Reset for next test
    execSync('git checkout -- file.txt', { cwd: ROOT });
  });

  it('runs git branch', async () => {
    const result = await gitOpsTool.execute({ operation: 'branch' });
    expect(result.success).toBe(true);
    // Should show at least the default branch
    expect(result.data).toBeDefined();
  });

  it('runs git show', async () => {
    const result = await gitOpsTool.execute({ operation: 'show' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('initial commit');
  });

  it('requires file path for blame', async () => {
    const result = await gitOpsTool.execute({ operation: 'blame' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('requires a file path');
  });

  it('runs git blame with a file', async () => {
    const result = await gitOpsTool.execute({ operation: 'blame', args: ['file.txt'] });
    expect(result.success).toBe(true);
    expect(result.content).toContain('initial content');
  });

  it('blocks --force flag', async () => {
    const result = await gitOpsTool.execute({ operation: 'log', args: ['--force'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Dangerous flag');
  });

  it('blocks --hard flag', async () => {
    const result = await gitOpsTool.execute({ operation: 'status', args: ['--hard'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Dangerous flag');
  });

  it('blocks --delete flag', async () => {
    const result = await gitOpsTool.execute({ operation: 'branch', args: ['--delete', 'main'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Dangerous flag');
  });

  it('blocks -D flag', async () => {
    const result = await gitOpsTool.execute({ operation: 'branch', args: ['-D', 'main'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Dangerous flag');
  });
});
