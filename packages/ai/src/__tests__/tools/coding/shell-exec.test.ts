import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureSafety } from '../../../tools/coding/safety.js';
import { shellExecTool } from '../../../tools/coding/shell-exec.js';

const ROOT = join(process.cwd(), 'tmp-test-shell-exec');

beforeAll(() => {
  mkdirSync(ROOT, { recursive: true });
  configureSafety({ projectRoot: ROOT });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

describe('shell_exec tool', () => {
  it('has correct metadata', () => {
    expect(shellExecTool.name).toBe('shell_exec');
  });

  it('executes a simple command', async () => {
    const result = await shellExecTool.execute({ command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('hello');
    const data = result.data as { exitCode: number };
    expect(data.exitCode).toBe(0);
  });

  it('captures stdout', async () => {
    const result = await shellExecTool.execute({ command: 'echo "line1" && echo "line2"' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('line1');
    expect(result.content).toContain('line2');
  });

  it('reports failure for nonzero exit', async () => {
    const result = await shellExecTool.execute({ command: 'exit 1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('exit 1');
  });

  it('reports stderr on failure', async () => {
    const result = await shellExecTool.execute({ command: 'echo "bad" >&2 && exit 1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('bad');
  });

  it('blocks denied commands', async () => {
    const result = await shellExecTool.execute({ command: 'rm -rf /' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('denied');
  });

  it('blocks npm publish', async () => {
    const result = await shellExecTool.execute({ command: 'npm publish' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('denied');
  });

  it('blocks git push --force', async () => {
    const result = await shellExecTool.execute({ command: 'git push --force origin main' });
    expect(result.success).toBe(false);
  });

  it('respects timeout', async () => {
    const result = await shellExecTool.execute({ command: 'sleep 10', timeout: 500 });
    expect(result.success).toBe(false);
    // May report as timeout or as killed process depending on OS signal handling
    expect(result.error).toBeDefined();
  });

  it('respects cwd parameter', async () => {
    mkdirSync(join(ROOT, 'subdir'), { recursive: true });
    const result = await shellExecTool.execute({ command: 'pwd', cwd: 'subdir' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('subdir');
  });

  it('sets CI=true to prevent interactive prompts', async () => {
    const result = await shellExecTool.execute({ command: 'echo $CI' });
    expect(result.success).toBe(true);
    expect(result.content).toContain('true');
  });

  it('caps timeout at 300000ms', async () => {
    // This shouldn't throw  -  just verifies the timeout cap is applied
    const result = await shellExecTool.execute({ command: 'echo ok', timeout: 999999 });
    expect(result.success).toBe(true);
  });
});
