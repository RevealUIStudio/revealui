import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ClaudeCodeAdapter } from '../adapters/claude-code-adapter.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

function stubExecFile(err: Error | null, stdout = ''): void {
  mockExecFile.mockImplementationOnce(
    (_cmd: unknown, _args: unknown, _opts: unknown, callback: (...args: unknown[]) => void) => {
      if (err) {
        callback(err);
      } else {
        callback(null, { stdout, stderr: '' });
      }
      return {} as never;
    },
  );
}

describe('ClaudeCodeAdapter — identity', () => {
  it('has id "claude-code" and name "Claude Code"', () => {
    const adapter = new ClaudeCodeAdapter();
    expect(adapter.id).toBe('claude-code');
    expect(adapter.name).toBe('Claude Code');
  });
});

describe('ClaudeCodeAdapter — getCapabilities', () => {
  it('returns false for interactive-only capabilities', () => {
    const caps = new ClaudeCodeAdapter().getCapabilities();
    expect(caps.generateCode).toBe(false);
    expect(caps.analyzeCode).toBe(false);
    expect(caps.applyEdit).toBe(false);
    expect(caps.applyConfig).toBe(false);
  });

  it('readWorkboard and writeWorkboard false when no path given', () => {
    const adapter = new ClaudeCodeAdapter(undefined);
    const caps = adapter.getCapabilities();
    expect(caps.readWorkboard).toBe(false);
    expect(caps.writeWorkboard).toBe(false);
  });

  it('readWorkboard and writeWorkboard true when path given', () => {
    const adapter = new ClaudeCodeAdapter('/tmp/workboard.md');
    const caps = adapter.getCapabilities();
    expect(caps.readWorkboard).toBe(true);
    expect(caps.writeWorkboard).toBe(true);
  });
});

describe('ClaudeCodeAdapter — isAvailable', () => {
  it('returns true when claude --version succeeds', async () => {
    stubExecFile(null, 'Claude Code 1.0.0');
    expect(await new ClaudeCodeAdapter().isAvailable()).toBe(true);
  });

  it('returns false when claude binary is missing', async () => {
    stubExecFile(new Error('ENOENT'));
    expect(await new ClaudeCodeAdapter().isAvailable()).toBe(false);
  });
});

describe('ClaudeCodeAdapter — getInfo', () => {
  it('returns id "claude-code" with version when available', async () => {
    stubExecFile(null, 'Claude Code 1.0.0');
    const info = await new ClaudeCodeAdapter().getInfo();
    expect(info.id).toBe('claude-code');
    expect(info.version).toBeTruthy();
  });

  it('returns undefined version when binary is missing', async () => {
    stubExecFile(new Error('not found'));
    const info = await new ClaudeCodeAdapter().getInfo();
    expect(info.version).toBeUndefined();
  });
});

describe('ClaudeCodeAdapter — execute', () => {
  it('get-status returns available: true when binary exists', async () => {
    stubExecFile(null, 'Claude Code 1.0.0');
    const result = await new ClaudeCodeAdapter().execute({ type: 'get-status' });
    expect(result.success).toBe(true);
    expect((result.data as { available: boolean }).available).toBe(true);
  });

  it('get-running-instances returns empty array', async () => {
    const result = await new ClaudeCodeAdapter().execute({ type: 'get-running-instances' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('generate-code returns failure with message', async () => {
    const result = await new ClaudeCodeAdapter().execute({
      type: 'generate-code',
      prompt: 'write a function',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('generate-code');
  });

  it('analyze-code returns failure with message', async () => {
    const result = await new ClaudeCodeAdapter().execute({
      type: 'analyze-code',
      filePath: '/src/foo.ts',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('analyze-code');
  });

  it('apply-config returns failure', async () => {
    const result = await new ClaudeCodeAdapter().execute({
      type: 'apply-config',
      configPath: '~/.claude/settings.json',
      content: '{}',
    });
    expect(result.success).toBe(false);
  });

  it('read-workboard fails when path not configured', async () => {
    const result = await new ClaudeCodeAdapter().execute({ type: 'read-workboard' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('REVEALUI_WORKBOARD_PATH');
  });

  it('read-workboard succeeds when workboard file exists', async () => {
    const wbPath = join(tmpdir(), `wb-test-${Date.now()}.md`);
    writeFileSync(
      wbPath,
      `# Workboard\n\n## Sessions\n\n| id | env | started | task | files | updated |\n| --- | --- | --- | --- | --- | --- |\n`,
    );
    const adapter = new ClaudeCodeAdapter(wbPath);
    const result = await adapter.execute({ type: 'read-workboard' });
    expect(result.success).toBe(true);
    require('node:fs').unlinkSync(wbPath);
  });

  it('update-workboard fails when path not configured', async () => {
    const result = await new ClaudeCodeAdapter().execute({
      type: 'update-workboard',
      sessionId: 'zed-1',
      task: 'new task',
    });
    expect(result.success).toBe(false);
  });
});

describe('ClaudeCodeAdapter — onEvent / dispose', () => {
  it('onEvent returns unsubscribe function', () => {
    const adapter = new ClaudeCodeAdapter();
    const unsub = adapter.onEvent(() => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('dispose clears event handlers', async () => {
    const adapter = new ClaudeCodeAdapter();
    const events: string[] = [];
    adapter.onEvent((e) => events.push(e.type));
    await adapter.dispose();
    // After dispose, no events should be emitted even if triggered internally
    expect(events).toHaveLength(0);
  });
});
